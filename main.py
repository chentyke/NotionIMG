from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from notion_client import Client
import os
import logging
from typing import List, Dict, Optional
import httpx
from pydantic import BaseModel, BaseSettings, Field

class Settings(BaseSettings):
    """应用配置模型"""
    # Notion API配置
    notion_token: str = Field(..., env='NOTION_TOKEN', description="Notion API Token")
    notion_database_id: str = Field(..., env='NOTION_DATABASE_ID', description="Notion Database ID")
    notion_api_version: str = Field("2022-06-28", env='NOTION_API_VERSION', description="Notion API Version")
    
    # 服务器配置
    host: str = Field("0.0.0.0", env='HOST', description="Server host")
    port: int = Field(8000, env='PORT', description="Server port")
    
    # 日志配置
    log_level: str = Field("INFO", env='LOG_LEVEL', description="Logging level")
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# 创建配置实例
try:
    settings = Settings()
except Exception as e:
    print(f"Error loading configuration: {str(e)}")
    raise SystemExit(1)

# 配置日志级别
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Tyke's Drive",
    description="A simple file hosting service that reads files from Notion database"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize Notion client
try:
    notion = Client(auth=settings.notion_token)
except Exception as e:
    logger.error(f"Failed to initialize Notion client: {str(e)}")
    raise SystemExit(1)

DATABASE_ID = settings.notion_database_id

# 存储页面数据的字典
pages_data = {}
suffix_pages = {}

class Page(BaseModel):
    id: str
    title: str
    last_edited_time: str
    created_time: Optional[str] = None
    parent_id: Optional[str] = None
    edit_date: Optional[str] = None
    show_back: Optional[bool] = True
    suffix: Optional[str] = None

class APIResponse(BaseModel):
    """标准API响应模型"""
    success: bool
    message: str = ""
    data: Optional[dict] = None

async def init_pages():
    """初始化时加载所有页面的数据"""
    try:
        logger.info("Starting to initialize pages...")
        # 清空现有数据
        pages_data.clear()
        suffix_pages.clear()
        
        # 查询数据库中的所有页面
        response = notion.databases.query(database_id=DATABASE_ID)
        pages = response['results']
        
        logger.info(f"Found total {len(pages)} pages in database")
        logger.info("Database query response:")
        logger.info(response)
        
        # 处理每个页面
        for page in pages:
            try:
                page_id = page['id']
                logger.info(f"\n{'='*50}")
                logger.info(f"Processing page {page_id}")
                
                # 获取页面属性
                properties = page.get('properties', {})
                logger.info(f"Raw properties data:")
                logger.info(properties)
                
                # 获取标题
                title = ''
                title_obj = properties.get('title', properties.get('Name', {}))
                if title_obj and title_obj.get('title'):
                    title = title_obj['title'][0].get('plain_text', 'Untitled')
                logger.info(f"Extracted title: {title}")
                
                # 获取 suffix
                suffix = ''
                suffix_obj = properties.get('suffix', {})
                logger.info(f"Raw suffix object:")
                logger.info(suffix_obj)
                
                # 处理文本类型的 suffix
                if suffix_obj:
                    prop_type = suffix_obj.get('type', '')
                    logger.info(f"Suffix property type: {prop_type}")
                    
                    if prop_type == 'rich_text':
                        rich_text = suffix_obj.get('rich_text', [])
                        if rich_text:
                            suffix = rich_text[0].get('plain_text', '')
                    elif prop_type == 'text':
                        text_content = suffix_obj.get('text', {})
                        logger.info(f"Text content:")
                        logger.info(text_content)
                        if isinstance(text_content, str):
                            suffix = text_content
                        elif isinstance(text_content, dict):
                            suffix = text_content.get('content', '')
                
                logger.info(f"Final extracted suffix: '{suffix}'")
                
                # 创建页面对象
                page_obj = Page(
                    id=page_id,
                    title=title,
                    created_time=page.get('created_time', ''),
                    last_edited_time=page.get('last_edited_time', ''),
                    parent_id=page.get('parent', {}).get('database_id'),
                    edit_date=page.get('last_edited_time', ''),
                    show_back=True,
                    suffix=suffix
                )
                
                # 更新数据存储
                pages_data[page_id] = page_obj.dict()
                logger.info(f"Added to pages_data: {page_obj.dict()}")
                
                # 更新 suffix 索引
                if suffix:
                    logger.info(f"Processing suffix: '{suffix}'")
                    if suffix not in suffix_pages:
                        suffix_pages[suffix] = []
                        logger.info(f"Created new suffix entry for '{suffix}'")
                    if page_obj.dict() not in suffix_pages[suffix]:
                        suffix_pages[suffix].append(page_obj.dict())
                        logger.info(f"Added page to suffix '{suffix}'")
            
            except Exception as e:
                logger.error(f"Error processing page {page.get('id', 'unknown')}: {str(e)}")
                logger.error(f"Stack trace:", exc_info=True)
                continue
        
        logger.info(f"\n{'='*50}")
        logger.info("Initialization complete:")
        logger.info(f"Total pages in pages_data: {len(pages_data)}")
        logger.info(f"Total unique suffixes: {len(suffix_pages)}")
        logger.info("Suffix pages mapping:")
        for suffix, pages in suffix_pages.items():
            logger.info(f"Suffix '{suffix}': {len(pages)} pages")
            for page in pages:
                logger.info(f"  - {page['title']} ({page['id']})")
        
    except Exception as e:
        logger.error(f"Error initializing pages: {str(e)}")
        logger.error(f"Stack trace:", exc_info=True)
        raise

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化函数"""
    logger.info("Starting application...")
    
    # 验证数据库访问
    if not await verify_database_access():
        logger.error("Database access verification failed")
        raise SystemExit(1)
    
    # 初始化页面数据
    try:
        await init_pages()
    except Exception as e:
        logger.error(f"Failed to initialize pages: {str(e)}")
        raise SystemExit(1)
    
    logger.info(f"Application started successfully on {settings.host}:{settings.port}")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理函数"""
    logger.info("Shutting down application...")
    # 清理资源
    pages_data.clear()
    suffix_pages.clear()
    logger.info("Application shutdown complete")

@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")

def get_file_info(page: dict) -> dict:
    """Extract file information from a Notion page."""
    try:
        title = page["properties"]["Name"]["title"][0]["text"]["content"]
        content = page["properties"].get("Content", {}).get("files", [])
        hidden = page["properties"].get("Hidden", {}).get("select", {}).get("name") == "True"
        
        if not content or hidden:
            return None
            
        file_data = content[0]
        file_url = file_data.get("file", {}).get("url")
        
        if not file_url:
            return None
            
        return {
            "id": page["id"],
            "title": title
        }
        
    except (KeyError, IndexError) as e:
        logger.warning(f"Error extracting file info: {e}")
        return None

def get_page_info(page: dict) -> dict:
    """Extract page information."""
    try:
        # Try to get title from properties first
        if "properties" in page and "Name" in page["properties"]:
            title = page["properties"]["Name"]["title"][0]["text"]["content"]
            hidden = page["properties"].get("Hidden", {}).get("select", {}).get("name") == "True"
            
            # Get Back property if it exists
            back_property = page["properties"].get("Back", {}).get("select", {}).get("name")
            show_back = True if back_property is None else back_property != "False"
            
            if hidden:
                return None
        else:
            # For child pages, try to get title from child_page object first
            child_page = page.get("child_page", {})
            if child_page:
                title = child_page.get("title", "Untitled")
            else:
                # Try to get title from page object
                title = page.get("title", "Untitled")
            show_back = True
            
        return {
            "id": page["id"],
            "title": title,
            "created_time": page["created_time"],
            "last_edited_time": page["last_edited_time"],
            "parent_id": page.get("parent", {}).get("page_id"),
            "edit_date": page["last_edited_time"],  # Use last_edited_time as edit_date
            "show_back": show_back  # Add show_back to response
        }
    except (KeyError, IndexError) as e:
        logger.warning(f"Error extracting page info: {e}")
        return None

def process_rich_text(rich_text_array):
    """Process rich text array to include formatting."""
    if not rich_text_array:
        return ""
    
    formatted_text = []
    for text in rich_text_array:
        # Get the text content
        content = text.get("plain_text", "")
        
        # Start with an empty list of HTML tags
        tags = []
        
        # Process annotations
        annotations = text.get("annotations", {})
        if annotations.get("bold"):
            tags.append(("strong", {}))
        if annotations.get("italic"):
            tags.append(("em", {}))
        if annotations.get("strikethrough"):
            tags.append(("del", {}))
        if annotations.get("underline"):
            tags.append(("u", {}))
        if annotations.get("code"):
            tags.append(("code", {"class": "inline-code"}))
        
        # Process color
        color = annotations.get("color", "default")
        if color != "default":
            if color.endswith("_background"):
                tags.append(("span", {"class": f"bg-{color.replace('_background', '')}"}))
            else:
                tags.append(("span", {"class": f"text-{color}"}))
        
        # Process links
        href = text.get("href")
        if href:
            tags.append(("a", {"href": href, "target": "_blank", "rel": "noopener noreferrer"}))
        
        # Apply all the formatting
        formatted = content
        for tag, attrs in reversed(tags):
            attr_str = " ".join([f'{k}="{v}"' for k, v in attrs.items()])
            formatted = f"<{tag} {attr_str}>{formatted}</{tag}>" if attr_str else f"<{tag}>{formatted}</{tag}>"
        
        formatted_text.append(formatted)
    
    return "".join(formatted_text)

def process_block_content(block: dict) -> dict:
    """Process block content."""
    try:
        block_type = block["type"]
        block_content = block[block_type]
        
        # Get color if present
        color = block.get("color", "default")
        
        # Process rich text content
        if "rich_text" in block_content:
            text = process_rich_text(block_content["rich_text"])
        else:
            text = ""

        # Initialize result
        result = {
            "type": block_type,
            "text": text,
            "color": color
        }

        # Process children if present
        if block.get("has_children", False):
            try:
                child_blocks = notion.blocks.children.list(block_id=block["id"])["results"]
                children = []
                for child_block in child_blocks:
                    child_content = process_block_content(child_block)
                    if child_content:
                        children.append(child_content)
                if children:
                    result["children"] = children
            except Exception as e:
                logger.error(f"Error processing child blocks for {block['id']}: {e}")

        # Handle specific block types
        if block_type == "image":
            result["image_url"] = block_content.get("file", {}).get("url") or block_content.get("external", {}).get("url")
            if "caption" in block_content and block_content["caption"]:
                result["caption"] = process_rich_text(block_content["caption"])
        elif block_type == "code":
            result["language"] = block_content.get("language", "plain text")
        elif block_type == "child_page":
            result["page_id"] = block["id"]
            result["title"] = block_content.get("title", "Untitled")
        elif block_type == "toggle":
            # For toggle blocks, we need to process the rich_text content
            result["text"] = process_rich_text(block_content["rich_text"])
            logger.info(f"Toggle block {block['id']}: text='{result['text']}'")
            
            # Process children if present
            if block.get("has_children", False):
                try:
                    child_blocks = notion.blocks.children.list(block_id=block["id"])["results"]
                    logger.info(f"Toggle block {block['id']}: found {len(child_blocks)} children")
                    children = []
                    for child_block in child_blocks:
                        logger.info(f"Toggle block {block['id']}: processing child of type '{child_block['type']}'")
                        child_content = process_block_content(child_block)
                        if child_content:
                            children.append(child_content)
                    if children:
                        result["children"] = children
                        logger.info(f"Toggle block {block['id']}: processed {len(children)} children successfully")
                    else:
                        logger.warning(f"Toggle block {block['id']}: no valid children found")
                except Exception as e:
                    logger.error(f"Error processing toggle children for {block['id']}: {e}")
                    logger.error(f"Toggle block content: {block_content}")
        elif block_type == "table":
            result["has_column_header"] = block_content.get("has_column_header", False)
            result["has_row_header"] = block_content.get("has_row_header", False)
        elif block_type == "table_row":
            cells = []
            for cell in block_content.get("cells", []):
                cell_text = process_rich_text(cell)
                cells.append(cell_text)
            result["cells"] = cells

        return result
    except Exception as e:
        logger.warning(f"Error processing block content: {e}")
        return None

@app.get("/images")
async def get_images():
    try:
        response = notion.databases.query(
            database_id=DATABASE_ID,
            filter={
                "property": "type",
                "select": {
                    "equals": "image"
                }
            }
        )
        
        images = []
        for page in response["results"]:
            file_info = get_file_info(page)
            if file_info:
                images.append(file_info)
                
        return {"images": images}
    except Exception as e:
        logger.error(f"Error fetching images: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files")
async def get_files():
    try:
        response = notion.databases.query(
            database_id=DATABASE_ID,
            filter={
                "property": "type",
                "select": {
                    "equals": "file"
                }
            }
        )
        
        files = []
        for page in response["results"]:
            file_info = get_file_info(page)
            if file_info:
                files.append(file_info)
                
        return {"files": files}
    except Exception as e:
        logger.error(f"Error fetching files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pages")
async def get_pages():
    try:
        response = notion.databases.query(
            database_id=DATABASE_ID,
            filter={
                "property": "type",
                "select": {
                    "equals": "page"
                }
            }
        )
        
        pages = []
        for page in response["results"]:
            page_info = get_page_info(page)
            if page_info:
                pages.append(page_info)
                
        return {"pages": pages}
    except Exception as e:
        logger.error(f"Error fetching pages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/page/{page_id}")
async def get_page_content(page_id: str):
    try:
        logger.info(f"Fetching page content for ID: {page_id}")
        # First try to get the block to check if it's a child page
        try:
            block = notion.blocks.retrieve(block_id=page_id)
            logger.info(f"Retrieved block type: {block['type']}")
            if block["type"] == "child_page":
                # If it's a child page, use the title from the block
                # Try to get the full page to check for Back property
                try:
                    page = notion.pages.retrieve(page_id=page_id)
                    back_property = page.get("properties", {}).get("Back", {}).get("select", {}).get("name")
                    show_back = True if back_property is None else back_property != "False"
                except:
                    show_back = True  # Default to True if can't get the property
                
                page_info = {
                    "id": block["id"],
                    "title": block["child_page"]["title"],
                    "created_time": block["created_time"],
                    "last_edited_time": block["last_edited_time"],
                    "parent_id": block["parent"]["page_id"] if block["parent"]["type"] == "page_id" else None,
                    "show_back": show_back
                }
                logger.info(f"Found child page: {page_info['title']}")
            else:
                # If it's not a child page, get page metadata normally
                page = notion.pages.retrieve(page_id=page_id)
                page_info = get_page_info(page)
                logger.info(f"Found regular page: {page_info['title'] if page_info else 'None'}")
        except Exception as e:
            logger.warning(f"Error retrieving block, trying page: {e}")
            # If block retrieval fails, try page retrieval as fallback
            page = notion.pages.retrieve(page_id=page_id)
            page_info = get_page_info(page)
            if page_info and "parent" in page and page["parent"]["type"] == "page_id":
                page_info["parent_id"] = page["parent"]["page_id"]
        
        if not page_info:
            logger.error("Page info not found")
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Get page blocks
        blocks = []
        has_more = True
        cursor = None
        total_blocks = 0
        
        logger.info("Fetching page blocks...")
        while has_more:
            if cursor:
                response = notion.blocks.children.list(block_id=page_id, start_cursor=cursor)
            else:
                response = notion.blocks.children.list(block_id=page_id)
            
            current_blocks = response["results"]
            total_blocks += len(current_blocks)
            logger.info(f"Retrieved {len(current_blocks)} blocks (total: {total_blocks})")
            
            for block in current_blocks:
                logger.info(f"Processing block type: {block['type']}")
                processed_block = process_block_content(block)
                if processed_block:
                    blocks.append(processed_block)
            
            has_more = response["has_more"]
            if has_more:
                cursor = response["next_cursor"]
                logger.info("More blocks available, continuing...")
        
        logger.info(f"Successfully processed {len(blocks)} blocks")
        return {
            "page": page_info,
            "blocks": blocks
        }
    except Exception as e:
        logger.error(f"Error getting page content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/image/{image_id}")
async def get_image(image_id: str):
    try:
        page = notion.pages.retrieve(page_id=image_id)
        content_property = page["properties"].get("Content")
        
        if not content_property or not content_property.get("files"):
            raise HTTPException(status_code=404, detail="No image found")
            
        image_url = content_property["files"][0]["file"]["url"]
        logger.info(f"Redirecting to fresh image URL for {image_id}")
        return RedirectResponse(url=image_url)
        
    except Exception as e:
        logger.error(f"Error retrieving image {image_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/file/{file_id}")
async def get_file(file_id: str):
    try:
        page = notion.pages.retrieve(page_id=file_id)
        content_property = page["properties"].get("Content")
        
        if not content_property or not content_property.get("files"):
            raise HTTPException(status_code=404, detail="No file found")
            
        file_url = content_property["files"][0]["file"]["url"]
        logger.info(f"Redirecting to fresh file URL for {file_id}")
        return RedirectResponse(url=file_url)
        
    except Exception as e:
        logger.error(f"Error retrieving file {file_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def read_root():
    return FileResponse("static/pages.html")

@app.get("/page/{page_id}")
async def read_page(page_id: str):
    return FileResponse("static/page.html")

@app.get("/{suffix}")
async def read_suffix_pages(suffix: str):
    try:
        logger.info(f"\n{'='*50}")
        logger.info(f"Accessing suffix route: '{suffix}'")
        logger.info(f"Current suffix_pages keys: {list(suffix_pages.keys())}")
        
        # 检查suffix是否存在且有对应的页面
        if suffix not in suffix_pages or not suffix_pages[suffix]:
            logger.warning(f"No valid pages found for suffix '{suffix}'")
            raise HTTPException(status_code=404, detail="No pages found for this suffix")
            
        pages = suffix_pages[suffix]
        logger.info(f"Found {len(pages)} pages for suffix '{suffix}'")
        
        if len(pages) > 1:
            logger.info(f"Multiple pages found for suffix '{suffix}', returning list page")
            return FileResponse("static/suffix_pages.html")
        else:
            logger.info(f"Single page found for suffix '{suffix}', returning page")
            return FileResponse("static/page.html")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing suffix route '{suffix}': {str(e)}")
        logger.error("Stack trace:", exc_info=True)
        logger.error(f"Current suffix_pages state: {suffix_pages}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/pages", response_model=APIResponse)
async def get_pages(suffix: Optional[str] = None):
    """
    获取页面列表
    
    参数:
        suffix: 可选的后缀过滤器
        
    返回:
        - 如果指定了suffix，返回具有该后缀的页面列表
        - 否则返回所有页面列表
    """
    try:
        if suffix:
            logger.info(f"Getting pages with suffix: {suffix}")
            pages = suffix_pages.get(suffix, [])
            logger.info(f"Found {len(pages)} pages with suffix {suffix}")
            return APIResponse(
                success=True,
                message=f"Found {len(pages)} pages with suffix '{suffix}'",
                data={"pages": pages}
            )
        return APIResponse(
            success=True,
            message=f"Retrieved all pages",
            data={"pages": list(pages_data.values())}
        )
    except Exception as e:
        logger.error(f"Error getting pages: {str(e)}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve pages")

@app.get("/api/page/{page_id}", response_model=APIResponse)
async def get_page(page_id: str):
    """
    获取单个页面的详细信息
    
    参数:
        page_id: Notion页面ID
        
    返回:
        包含页面详细信息的响应
    """
    try:
        page_data = notion.pages.retrieve(page_id=page_id)
        properties = page_data.get('properties', {})
        
        # 获取标题
        title = ''
        title_obj = properties.get('title', properties.get('Name', {}))
        if title_obj and title_obj.get('title'):
            title = title_obj['title'][0].get('plain_text', 'Untitled')
        
        # 获取 suffix
        suffix = ''
        suffix_obj = properties.get('suffix', {})
        
        # 处理文本类型的 suffix
        if suffix_obj:
            prop_type = suffix_obj.get('type', '')
            
            if prop_type == 'rich_text':
                rich_text = suffix_obj.get('rich_text', [])
                if rich_text:
                    suffix = rich_text[0].get('plain_text', '')
            elif prop_type == 'text':
                text_content = suffix_obj.get('text', {})
                if isinstance(text_content, str):
                    suffix = text_content
                elif isinstance(text_content, dict):
                    suffix = text_content.get('content', '')
        
        # 更新页面数据
        page = Page(
            id=page_id,
            title=title,
            last_edited_time=page_data.get('last_edited_time', ''),
            created_time=page_data.get('created_time', ''),
            parent_id=page_data.get('parent', {}).get('database_id'),
            edit_date=page_data.get('last_edited_time', ''),
            show_back=True,
            suffix=suffix
        )
        
        # 更新 pages_data
        pages_data[page_id] = page.dict()
        
        # 更新 suffix_pages
        # 1. 先从所有suffix列表中移除这个页面
        for s in list(suffix_pages.keys()):
            suffix_pages[s] = [p for p in suffix_pages[s] if p['id'] != page_id]
            # 如果某个suffix没有页面了，删除这个suffix
            if not suffix_pages[s]:
                del suffix_pages[s]
        
        # 2. 将页面添加到新的suffix下
        if suffix:
            if suffix not in suffix_pages:
                suffix_pages[suffix] = []
            suffix_pages[suffix].append(page.dict())
            logger.info(f"Updated page {page_id} with suffix: {suffix}")
        
        return APIResponse(
            success=True,
            message="Page retrieved successfully",
            data={"page": page_data}
        )
    except Exception as e:
        logger.error(f"Error getting page {page_id}: {str(e)}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve page data")

@app.get("/api/blocks/{page_id}", response_model=APIResponse)
async def get_blocks(page_id: str):
    """
    获取页面的块内容
    
    参数:
        page_id: Notion页面ID
        
    返回:
        包含页面块内容的响应
    """
    try:
        headers = {
            "Authorization": f"Bearer {settings.notion_token}",
            "Notion-Version": settings.notion_api_version
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.notion.com/v1/blocks/{page_id}/children",
                headers=headers
            )
            response.raise_for_status()
            blocks_data = response.json()
            return APIResponse(
                success=True,
                message="Blocks retrieved successfully",
                data={"blocks": blocks_data}
            )
    except httpx.HTTPError as e:
        logger.error(f"HTTP error occurred: {str(e)}")
        raise HTTPException(status_code=502, detail="Failed to fetch page blocks")
    except Exception as e:
        logger.error(f"Error getting blocks for page {page_id}: {str(e)}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

async def verify_database_access():
    """验证数据库访问权限"""
    try:
        logger.info("Verifying database access...")
        response = notion.databases.retrieve(database_id=DATABASE_ID)
        logger.info(f"Successfully connected to database: {response.get('title', [{}])[0].get('plain_text', 'Untitled')}")
        return True
    except Exception as e:
        logger.error(f"Failed to access database: {str(e)}")
        return False

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port) 