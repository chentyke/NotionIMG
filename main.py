from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from notion_client import Client
import os
import logging
from typing import List, Dict, Optional
import httpx
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
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

# Initialize Notion client with timeout settings
try:
    notion = Client(
        auth=os.environ.get("NOTION_TOKEN"),
        timeout_ms=30000  # 30 second timeout
    )
except Exception as e:
    logger.error(f"Failed to initialize Notion client: {e}")
    notion = None

DATABASE_ID = os.environ.get("NOTION_DATABASE_ID")

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

async def init_pages():
    """初始化时加载所有页面的数据"""
    if not notion:
        logger.error("Notion client not initialized, skipping page initialization")
        return
        
    try:
        import asyncio
        from functools import partial
        
        logger.info("\n" + "="*50)
        logger.info("Starting to initialize pages...")
        # 清空现有数据
        pages_data.clear()
        suffix_pages.clear()
        
        # 查询数据库中的所有页面 - 使用异步包装
        logger.info("Querying Notion database with pagination...")
        pages = []
        cursor = None
        max_retries = 3
        
        while True:
            query_params = {
                "database_id": DATABASE_ID,
                "filter": {
                    "and": [
                        {
                            "property": "type",
                            "select": {
                                "equals": "page"
                            }
                        },
                        {
                            "property": "Hidden",
                            "select": {
                                "equals": "False"
                            }
                        }
                    ]
                },
                "page_size": 100
            }
            
            if cursor:
                query_params["start_cursor"] = cursor
            
            # Retry logic for database queries
            for attempt in range(max_retries):
                try:
                    loop = asyncio.get_event_loop()
                    response = await asyncio.wait_for(
                        loop.run_in_executor(None, partial(notion.databases.query, **query_params)),
                        timeout=30.0  # 30 second timeout
                    )
                    break  # Success, exit retry loop
                except asyncio.TimeoutError:
                    logger.warning(f"Timeout on attempt {attempt + 1}/{max_retries} for database query")
                    if attempt == max_retries - 1:
                        logger.error("Max retries exceeded for database query")
                        return  # Skip initialization if all retries failed
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                except Exception as e:
                    logger.warning(f"Error on attempt {attempt + 1}/{max_retries}: {e}")
                    if attempt == max_retries - 1:
                        logger.error(f"Max retries exceeded: {e}")
                        return
                    await asyncio.sleep(2 ** attempt)
            
            # 记录原始响应数据用于调试
            logger.info(f"\nRaw response data:")
            logger.info(f"Has more: {response.get('has_more')}")
            logger.info(f"Next cursor: {response.get('next_cursor')}")
            logger.info(f"Results count: {len(response.get('results', []))}")
            
            fetched = response.get('results', [])
            pages.extend(fetched)
            
            logger.info(f"Fetched {len(fetched)} pages, total so far: {len(pages)}")
            
            if not response.get('has_more', False):
                break
            cursor = response.get('next_cursor')
            
        logger.info(f"Found {len(pages)} total pages in database")
        
        if not pages:
            logger.warning("No pages found in database")
            return
            
        # 处理每个页面
        for page in pages:
            try:
                page_id = page['id']
                logger.info(f"\nProcessing page {page_id}")
                
                # 获取页面属性
                properties = page.get('properties', {})
                logger.info(f"Page properties: {properties}")
                
                # 获取标题
                title = ''
                title_obj = properties.get('Name', properties.get('title', {}))
                if title_obj:
                    if title_obj.get('type') == 'title':
                        title_array = title_obj.get('title', [])
                        if title_array and len(title_array) > 0:
                            title = title_array[0].get('plain_text', 'Untitled')
                logger.info(f"Title: {title}")
                
                # 获取 suffix
                suffix = ''
                suffix_obj = properties.get('suffix', {})
                if suffix_obj:
                    prop_type = suffix_obj.get('type', '')
                    if prop_type == 'rich_text':
                        rich_text = suffix_obj.get('rich_text', [])
                        if rich_text and len(rich_text) > 0:
                            suffix = rich_text[0].get('plain_text', '')
                    elif prop_type == 'text':
                        text_content = suffix_obj.get('text', {})
                        if isinstance(text_content, str):
                            suffix = text_content
                        elif isinstance(text_content, dict):
                            suffix = text_content.get('content', '')
                
                logger.info(f"Final suffix: '{suffix}'")
                
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
                
                # 更新 pages_data
                pages_data[page_id] = page_obj.dict()
                logger.info(f"Added page to pages_data: {page_obj.dict()}")
                
                # 更新 suffix 索引
                if suffix:
                    if suffix not in suffix_pages:
                        suffix_pages[suffix] = []
                    if not any(p['id'] == page_id for p in suffix_pages[suffix]):
                        suffix_pages[suffix].append(page_obj.dict())
                        logger.info(f"Added page to suffix_pages[{suffix}]")
                
            except Exception as e:
                logger.error(f"Error processing page {page.get('id', 'unknown')}: {str(e)}")
                logger.error("Stack trace:", exc_info=True)
                continue
        
        logger.info("\nInitialization complete:")
        logger.info(f"Total pages in pages_data: {len(pages_data)}")
        logger.info(f"Total unique suffixes: {len(suffix_pages)}")
        logger.info("Pages data:")
        for page_id, page in pages_data.items():
            logger.info(f"  - {page['title']} ({page_id})")
        
    except Exception as e:
        logger.error(f"Error initializing pages: {str(e)}")
        logger.error("Stack trace:", exc_info=True)
        raise

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化函数"""
    try:
        # Check if environment variables are set
        if not os.environ.get("NOTION_TOKEN") or not os.environ.get("NOTION_DATABASE_ID"):
            logger.warning("NOTION_TOKEN or NOTION_DATABASE_ID not set, skipping page initialization")
            logger.warning("The app will run but may not function properly without proper configuration")
            return
        
        await init_pages()
    except Exception as e:
        logger.error(f"Error during startup initialization: {str(e)}")
        logger.warning("App will continue running but may not function properly")

@app.get("/")
async def root():
    """根路由处理"""
    return FileResponse("static/pages.html")

@app.get("/health")
async def health_check():
    """健康检查端点"""
    try:
        # 检查环境变量
        has_token = bool(os.environ.get("NOTION_TOKEN"))
        has_database_id = bool(os.environ.get("NOTION_DATABASE_ID"))
        
        # 检查 Notion 客户端
        notion_client_status = "initialized" if notion else "not_initialized"
        
        # 检查数据
        pages_count = len(pages_data)
        suffixes_count = len(suffix_pages)
        
        status = {
            "status": "healthy" if has_token and has_database_id and notion else "degraded",
            "notion_token": "present" if has_token else "missing",
            "database_id": "present" if has_database_id else "missing", 
            "notion_client": notion_client_status,
            "pages_loaded": pages_count,
            "suffixes_loaded": suffixes_count,
            "timestamp": "2024-01-01T00:00:00Z"  # 可以用实际时间戳
        }
        
        return status
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": "2024-01-01T00:00:00Z"
        }

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
        title = "Untitled"
        # Try to get title from properties first
        if "properties" in page:
            if "Name" in page["properties"]:
                title_array = page["properties"]["Name"]["title"]
                if title_array and len(title_array) > 0:
                    title = title_array[0]["text"]["content"]
            elif "title" in page["properties"]:
                title_array = page["properties"]["title"]["title"]
                if title_array and len(title_array) > 0:
                    title = title_array[0]["text"]["content"]
                    
            hidden = page["properties"].get("Hidden", {}).get("select", {}).get("name") == "True"
            back_property = page["properties"].get("Back", {}).get("select", {}).get("name")
            show_back = True if back_property is None else back_property != "False"
            
            if hidden:
                return None
        else:
            # For child pages, try different ways to get the title
            if "child_page" in page:
                title = page["child_page"].get("title", title)
            elif "title" in page:
                if isinstance(page["title"], list) and len(page["title"]) > 0:
                    title = page["title"][0].get("text", {}).get("content", title)
                elif isinstance(page["title"], str):
                    title = page["title"]
            show_back = True
            
        # Get cover object
        cover = None
        if page.get("cover"):
            cover = page["cover"]  # Return the entire cover object
            
        return {
            "id": page["id"],
            "title": title,
            "created_time": page.get("created_time"),
            "last_edited_time": page.get("last_edited_time"),
            "show_back": show_back,
            "cover": cover
        }
    except Exception as e:
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
        
        # Get color from block content instead of block
        color = block_content.get("color", "default")
        
        # Process rich text content
        if "rich_text" in block_content:
            text = process_rich_text(block_content["rich_text"])
        else:
            text = ""

        # Initialize result
        result = {
            "type": block_type,
            "text": text,
            "color": color,
            "id": block.get("id")  # Include block ID for frontend use
        }

        # Add block content specific data
        if block_type == "column_list":
            # 处理列表容器
            logger.info(f"Processing column_list block: {block['id']}")
            if block.get("has_children", False):
                try:
                    columns = notion.blocks.children.list(block_id=block["id"])["results"]
                    processed_columns = []
                    for column in columns:
                        if column["type"] == "column":
                            column_content = process_block_content(column)
                            if column_content:
                                processed_columns.append(column_content)
                    result["columns"] = processed_columns
                    logger.info(f"Processed {len(processed_columns)} columns in column_list")
                except Exception as e:
                    logger.error(f"Error processing column_list children: {e}")
                    result["columns"] = []

        elif block_type == "column":
            # 处理单个列
            logger.info(f"Processing column block: {block['id']}")
            if block.get("has_children", False):
                try:
                    column_blocks = notion.blocks.children.list(block_id=block["id"])["results"]
                    processed_blocks = []
                    for child_block in column_blocks:
                        child_content = process_block_content(child_block)
                        if child_content:
                            processed_blocks.append(child_content)
                    result["children"] = processed_blocks
                    logger.info(f"Processed {len(processed_blocks)} blocks in column")
                except Exception as e:
                    logger.error(f"Error processing column children: {e}")
                    result["children"] = []

        elif block_type == "paragraph":
            result["paragraph"] = {
                "rich_text": block_content.get("rich_text", []),
                "color": color
            }
        elif block_type in ["heading_1", "heading_2", "heading_3"]:
            result[block_type] = {
                "rich_text": block_content.get("rich_text", []),
                "color": color,
                "is_toggleable": block_content.get("is_toggleable", False)
            }
        elif block_type == "image":
            image_info = block_content.get("file") or block_content.get("external", {})
            result["image_url"] = image_info.get("url", "")
            if "caption" in block_content and block_content["caption"]:
                result["caption"] = process_rich_text(block_content["caption"])
        elif block_type == "code":
            result["language"] = block_content.get("language", "plain text")
            result["rich_text"] = block_content.get("rich_text", [])
        elif block_type == "child_page":
            result["page_id"] = block["id"]
            result["title"] = block_content.get("title", "Untitled")
        elif block_type == "toggle":
            # For toggle blocks, we need to process the rich_text content
            result["text"] = process_rich_text(block_content.get("rich_text", []))
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
                except Exception as e:
                    logger.error(f"Error processing toggle children for {block['id']}: {e}")
                    result["children"] = []
        elif block_type == "table":
            result["has_column_header"] = block_content.get("has_column_header", False)
            result["has_row_header"] = block_content.get("has_row_header", False)
            result["table_width"] = block_content.get("table_width", 0)
            
            # Process table rows if present
            if block.get("has_children", False):
                try:
                    table_rows = notion.blocks.children.list(block_id=block["id"])["results"]
                    rows = []
                    for row_block in table_rows:
                        if row_block["type"] == "table_row":
                            row_content = process_block_content(row_block)
                            if row_content:
                                rows.append(row_content)
                    result["rows"] = rows
                except Exception as e:
                    logger.error(f"Error processing table rows for {block['id']}: {e}")
                    result["rows"] = []
        elif block_type == "table_row":
            cells = []
            for cell_array in block_content.get("cells", []):
                # 每个单元格是一个富文本数组
                cells.append(cell_array)  # 保持原始富文本数组格式
            result["cells"] = cells
        elif block_type == "file":
            # 处理文件块
            logger.info(f"Processing file block: {block_content}")
            file_info = block_content.get("file") or block_content.get("external", {})
            result["file"] = {
                "type": block_content.get("type", "file"),
                "name": block_content.get("name", "Untitled"),
                "url": file_info.get("url", ""),
                "caption": block_content.get("caption", [])
            }
            logger.info(f"Processed file block result: {result}")
        elif block_type == "to_do":
            # 处理待办事项块
            result.update({
                "checked": block_content.get("checked", False),
                "text": process_rich_text(block_content.get("rich_text", [])),
                "color": color
            })
            # Process children if present
            if block.get("has_children", False):
                try:
                    child_blocks = notion.blocks.children.list(block_id=block["id"])["results"]
                    children = []
                    for child_block in child_blocks:
                        child_content = process_block_content(child_block)
                        if child_content:
                            children.append(child_content)
                    result["children"] = children
                except Exception as e:
                    logger.error(f"Error processing to_do children for {block['id']}: {e}")
                    result["children"] = []
        elif block_type == "bookmark":
            result["bookmark"] = {
                "url": block_content.get("url", ""),
                "caption": process_rich_text(block_content.get("caption", [])) if block_content.get("caption") else ""
            }
        elif block_type in ["bulleted_list_item", "numbered_list_item"]:
            # 处理列表项的富文本内容
            result = {
                "type": block_type,
                "text": text,
                "color": color,
                "content": {
                    "rich_text": block_content.get("rich_text", []),
                    "color": color
                }
            }
            
            # 处理嵌套内容
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
                    logger.error(f"Error processing list item children for {block['id']}: {e}")
                    result["children"] = []
        elif block_type == "video":
            # Handle video blocks
            video_info = block_content.get("file") or block_content.get("external", {})
            result["video"] = {
                "type": block_content.get("type", "external"),
                "url": video_info.get("url", ""),
                "caption": process_rich_text(block_content.get("caption", [])) if block_content.get("caption") else ""
            }
        elif block_type == "audio":
            # Handle audio blocks
            audio_info = block_content.get("file") or block_content.get("external", {})
            result["audio"] = {
                "type": block_content.get("type", "external"),
                "url": audio_info.get("url", ""),
                "caption": process_rich_text(block_content.get("caption", [])) if block_content.get("caption") else ""
            }
        elif block_type == "embed":
            # Handle embed blocks
            result["embed"] = {
                "url": block_content.get("url", ""),
                "caption": process_rich_text(block_content.get("caption", [])) if block_content.get("caption") else ""
            }
        elif block_type == "callout":
            # Handle callout blocks
            result["callout"] = {
                "rich_text": block_content.get("rich_text", []),
                "icon": block_content.get("icon"),
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
                    result["children"] = children
                except Exception as e:
                    logger.error(f"Error processing callout children for {block['id']}: {e}")
                    result["children"] = []
        elif block_type == "quote":
            # Handle quote blocks
            result["quote"] = {
                "rich_text": block_content.get("rich_text", []),
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
                    result["children"] = children
                except Exception as e:
                    logger.error(f"Error processing quote children for {block['id']}: {e}")
                    result["children"] = []
        elif block_type == "divider":
            # Handle divider blocks
            result["divider"] = {}
        elif block_type == "equation":
            # Handle equation blocks
            result["equation"] = {
                "expression": block_content.get("expression", "")
            }
        elif block_type == "breadcrumb":
            # Handle breadcrumb blocks
            result["breadcrumb"] = {}
        elif block_type == "table_of_contents":
            # Handle table of contents blocks
            result["table_of_contents"] = {
                "color": color
            }
        
        return result
    except Exception as e:
        logger.warning(f"Error processing block content: {e}")
        logger.warning(f"Block type: {block.get('type', 'unknown')}, Block ID: {block.get('id', 'unknown')}")
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

@app.get("/page/{page_id}")
async def get_page_content(page_id: str):
    try:
        logger.info(f"Fetching page content for ID: {page_id}")
        # First try to get the block to check if it's a child page
        try:
            block = notion.blocks.retrieve(block_id=page_id)
            logger.info(f"Retrieved block type: {block['type']}")
            if block["type"] == "child_page":
                # If it's a child page, get the full page to get all properties including cover
                try:
                    page = notion.pages.retrieve(page_id=page_id)
                    page_info = get_page_info(page)  # This will handle the cover properly
                    if page_info:
                        page_info["parent_id"] = block["parent"]["page_id"] if block["parent"]["type"] == "page_id" else None
                    logger.info(f"Found child page: {page_info['title'] if page_info else 'None'}")
                except Exception as e:
                    logger.warning(f"Error getting full page for child page, falling back to basic info: {e}")
                    # Try to get title from block first
                    title = block.get("child_page", {}).get("title", "")
                    if not title:
                        # Try to get title from page object if available
                        title = page.get("properties", {}).get("title", {}).get("title", [{}])[0].get("text", {}).get("content", "Untitled")
                    
                    back_property = page.get("properties", {}).get("Back", {}).get("select", {}).get("name")
                    show_back = True if back_property is None else back_property != "False"
                    page_info = {
                        "id": block["id"],
                        "title": title,
                        "created_time": block["created_time"],
                        "last_edited_time": block["last_edited_time"],
                        "parent_id": block["parent"]["page_id"] if block["parent"]["type"] == "page_id" else None,
                        "show_back": show_back,
                        "cover": None  # No cover in fallback case
                    }
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
        
        # Get page blocks with timeout and pagination support
        blocks = []
        has_more = True
        next_cursor = cursor
        total_blocks = 0
        blocks_processed = 0
        
        # Set default limit to 15 for initial load, None for subsequent loads
        effective_limit = limit if limit is not None else (15 if cursor is None else 100)
        
        logger.info(f"Fetching page blocks with limit={effective_limit}, cursor={cursor}")
        try:
            while has_more and (effective_limit is None or blocks_processed < effective_limit):
                # Wrap block children list call with timeout
                loop = asyncio.get_event_loop()
                
                # Build API parameters
                api_params = {"block_id": page_id}
                if next_cursor:
                    api_params["start_cursor"] = next_cursor
                
                # Calculate page size for this request
                remaining_limit = effective_limit - blocks_processed if effective_limit else 100
                page_size = min(100, remaining_limit) if effective_limit else 100
                api_params["page_size"] = page_size
                
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, partial(notion.blocks.children.list, **api_params)),
                    timeout=20.0  # 20 second timeout for blocks
                )
                
                current_blocks = response["results"]
                total_blocks += len(current_blocks)
                logger.info(f"Retrieved {len(current_blocks)} blocks (total: {total_blocks})")
                
                # Process blocks in the exact order received from Notion API
                batch_processed_blocks = []
                for i, block in enumerate(current_blocks):
                    if effective_limit and blocks_processed >= effective_limit:
                        break
                        
                    logger.info(f"Processing block {i+1}/{len(current_blocks)}, type: {block['type']}, id: {block.get('id', 'unknown')}")
                    processed_block = process_block_content(block)
                    if processed_block:
                        # Add sequence information to help with ordering
                        processed_block["_sequence"] = blocks_processed
                        processed_block["_batch"] = len(blocks) // 100  # Which batch this came from
                        batch_processed_blocks.append(processed_block)
                        blocks_processed += 1
                
                # Add batch to blocks list while preserving order
                blocks.extend(batch_processed_blocks)
                logger.info(f"Added {len(batch_processed_blocks)} processed blocks to output (total processed: {blocks_processed})")
                
                has_more = response["has_more"]
                if has_more:
                    next_cursor = response["next_cursor"]
                    logger.info(f"More blocks available, next_cursor: {next_cursor}")
                else:
                    next_cursor = None
                    
                # Stop if we've reached the limit
                if effective_limit and blocks_processed >= effective_limit:
                    logger.info(f"Reached limit of {effective_limit} blocks")
                    break
                    
        except asyncio.TimeoutError:
            logger.error(f"Timeout retrieving blocks for page {page_id}")
            # Return partial content instead of failing completely
            logger.info(f"Returning partial content with {len(blocks)} blocks")
            
        logger.info(f"Successfully processed {len(blocks)} blocks")
        
        response_data = {
            "page": page_info,
            "blocks": blocks,
            "has_more": has_more,
            "next_cursor": next_cursor,
            "total_loaded": blocks_processed,
            "debug_info": {
                "total_batches": (blocks_processed // 100) + 1,
                "blocks_with_sequence": len([b for b in blocks if "_sequence" in b]),
                "first_block_sequence": blocks[0].get("_sequence") if blocks else None,
                "last_block_sequence": blocks[-1].get("_sequence") if blocks else None,
                "request_cursor": cursor,
                "response_cursor": next_cursor
            }
        }
        
        # Add pagination info for debugging
        if cursor is None:
            logger.info(f"Initial load: returned {len(blocks)} blocks")
        else:
            logger.info(f"Subsequent load: returned {len(blocks)} blocks with cursor {cursor}")
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error getting page content: {e}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

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

@app.get("/static/page/{page_id}")
async def serve_page_html(page_id: str):
    """通过 page_id 访问页面 HTML"""
    logger.info(f"Serving page.html for page ID: {page_id}")
    return FileResponse("static/page.html")

@app.get("/{suffix}")
async def read_suffix_pages(suffix: str):
    """通过 suffix 访问页面"""
    try:
        logger.info(f"\n{'='*50}")
        logger.info(f"Accessing suffix route: '{suffix}'")
        
        # 检查是否是特殊路由
        if suffix == "page":
            logger.info("Detected 'page' route, returning page.html")
            return FileResponse("static/page.html")
            
        # 直接调用 API 函数获取页面数据
        response = await get_pages(suffix=suffix)
        pages = response["pages"]
        
        if not pages:
            logger.warning(f"No pages found for suffix '{suffix}'")
            # 返回自定义错误页面，而不是抛出 HTTPException
            return FileResponse("static/suffix_not_found.html")
        
        logger.info(f"Found {len(pages)} pages for suffix '{suffix}'")
        for page in pages:
            logger.info(f"  - {page['title']} ({page['id']})")
        
        # 根据页面数量返回不同的视图
        if len(pages) == 1:
            # 如果只有一个页面，重定向到带查询参数的页面
            page_id = pages[0]['id']
            logger.info(f"Redirecting to single page: {page_id}")
            return RedirectResponse(f"/static/page.html?id={page_id}", status_code=302)
        else:
            # 如果有多个页面，返回列表页面
            logger.info("Returning suffix_pages.html for multiple pages")
            return FileResponse("static/suffix_pages.html")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing suffix route '{suffix}': {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/pages")
async def get_pages(suffix: Optional[str] = None):
    """获取页面列表，支持通过 suffix 筛选"""
    try:
        # 确保数据是最新的
        logger.info("Initializing pages data...")
        await init_pages()
        
        if suffix:
            logger.info(f"\nGetting pages with suffix: '{suffix}'")
            logger.info(f"Available suffixes: {list(suffix_pages.keys())}")
            pages = suffix_pages.get(suffix, [])
            logger.info(f"Found {len(pages)} pages with suffix '{suffix}'")
            for page in pages:
                logger.info(f"  - {page['title']} ({page['id']})")
            return {"pages": pages}
            
        # 如果没有指定 suffix，返回所有页面
        all_pages = list(pages_data.values())
        logger.info(f"\nReturning all pages: {len(all_pages)} pages")
        logger.info("Pages data:")
        for page in all_pages:
            logger.info(f"  - {page['title']} ({page['id']})")
        return {"pages": all_pages}
    except Exception as e:
        logger.error(f"Error getting pages: {str(e)}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/page/{page_id}")
async def get_page(page_id: str, limit: Optional[int] = None, cursor: Optional[str] = None):
    try:
        logger.info(f"Fetching page content for API request: {page_id}, limit={limit}, cursor={cursor}")
        
        # Add timeout for Notion API calls
        import asyncio
        from functools import partial
        
        async def get_notion_data_with_timeout():
            # First try to get the block to check if it's a child page
            try:
                # Wrap synchronous notion calls in async with timeout
                loop = asyncio.get_event_loop()
                block = await asyncio.wait_for(
                    loop.run_in_executor(None, partial(notion.blocks.retrieve, block_id=page_id)),
                    timeout=15.0  # 15 second timeout
                )
                logger.info(f"Retrieved block type: {block['type']}")
                
                if block["type"] == "child_page":
                    # If it's a child page, get the full page to get all properties including cover
                    try:
                        page = await asyncio.wait_for(
                            loop.run_in_executor(None, partial(notion.pages.retrieve, page_id=page_id)),
                            timeout=15.0
                        )
                        page_info = get_page_info(page)  # This will handle the cover properly
                        if page_info:
                            page_info["parent_id"] = block["parent"]["page_id"] if block["parent"]["type"] == "page_id" else None
                        logger.info(f"Found child page: {page_info['title'] if page_info else 'None'}")
                    except Exception as e:
                        logger.warning(f"Error getting full page for child page, falling back to basic info: {e}")
                        # Try to get title from block first
                        title = block.get("child_page", {}).get("title", "")
                        if not title:
                            # Try to get title from page object if available
                            title = page.get("properties", {}).get("title", {}).get("title", [{}])[0].get("text", {}).get("content", "Untitled")
                        
                        back_property = page.get("properties", {}).get("Back", {}).get("select", {}).get("name")
                        show_back = True if back_property is None else back_property != "False"
                        page_info = {
                            "id": block["id"],
                            "title": title,
                            "created_time": block["created_time"],
                            "last_edited_time": block["last_edited_time"],
                            "parent_id": block["parent"]["page_id"] if block["parent"]["type"] == "page_id" else None,
                            "show_back": show_back,
                            "cover": None  # No cover in fallback case
                        }
                else:
                    # If it's not a child page, get page metadata normally
                    page = await asyncio.wait_for(
                        loop.run_in_executor(None, partial(notion.pages.retrieve, page_id=page_id)),
                        timeout=15.0
                    )
                    page_info = get_page_info(page)
                    logger.info(f"Found regular page: {page_info['title'] if page_info else 'None'}")
            except asyncio.TimeoutError:
                logger.error(f"Timeout retrieving page metadata for {page_id}")
                raise HTTPException(status_code=504, detail="Timeout retrieving page metadata from Notion API")
            except Exception as e:
                logger.warning(f"Error retrieving block, trying page: {e}")
                # If block retrieval fails, try page retrieval as fallback
                try:
                    page = await asyncio.wait_for(
                        loop.run_in_executor(None, partial(notion.pages.retrieve, page_id=page_id)),
                        timeout=15.0
                    )
                    page_info = get_page_info(page)
                    if page_info and "parent" in page and page["parent"]["type"] == "page_id":
                        page_info["parent_id"] = page["parent"]["page_id"]
                except asyncio.TimeoutError:
                    logger.error(f"Timeout retrieving page {page_id}")
                    raise HTTPException(status_code=504, detail="Timeout retrieving page from Notion API")
                except Exception as fallback_error:
                    logger.error(f"Both block and page retrieval failed for {page_id}: {fallback_error}")
                    raise HTTPException(status_code=404, detail="Page not found or inaccessible")
                    
            return page_info
            
        page_info = await get_notion_data_with_timeout()
        
        if not page_info:
            logger.error("Page info not found")
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Get page blocks with timeout and pagination support
        blocks = []
        has_more = True
        next_cursor = cursor
        total_blocks = 0
        blocks_processed = 0
        
        # Set default limit to 15 for initial load, None for subsequent loads
        effective_limit = limit if limit is not None else (15 if cursor is None else 100)
        
        logger.info(f"Fetching page blocks with limit={effective_limit}, cursor={cursor}")
        try:
            while has_more and (effective_limit is None or blocks_processed < effective_limit):
                # Wrap block children list call with timeout
                loop = asyncio.get_event_loop()
                
                # Build API parameters
                api_params = {"block_id": page_id}
                if next_cursor:
                    api_params["start_cursor"] = next_cursor
                
                # Calculate page size for this request
                remaining_limit = effective_limit - blocks_processed if effective_limit else 100
                page_size = min(100, remaining_limit) if effective_limit else 100
                api_params["page_size"] = page_size
                
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, partial(notion.blocks.children.list, **api_params)),
                    timeout=20.0  # 20 second timeout for blocks
                )
                
                current_blocks = response["results"]
                total_blocks += len(current_blocks)
                logger.info(f"Retrieved {len(current_blocks)} blocks (total: {total_blocks})")
                
                # Process blocks in the exact order received from Notion API
                batch_processed_blocks = []
                for i, block in enumerate(current_blocks):
                    if effective_limit and blocks_processed >= effective_limit:
                        break
                        
                    logger.info(f"Processing block {i+1}/{len(current_blocks)}, type: {block['type']}, id: {block.get('id', 'unknown')}")
                    processed_block = process_block_content(block)
                    if processed_block:
                        # Add sequence information to help with ordering
                        processed_block["_sequence"] = blocks_processed
                        processed_block["_batch"] = len(blocks) // 100  # Which batch this came from
                        batch_processed_blocks.append(processed_block)
                        blocks_processed += 1
                
                # Add batch to blocks list while preserving order
                blocks.extend(batch_processed_blocks)
                logger.info(f"Added {len(batch_processed_blocks)} processed blocks to output (total processed: {blocks_processed})")
                
                has_more = response["has_more"]
                if has_more:
                    next_cursor = response["next_cursor"]
                    logger.info(f"More blocks available, next_cursor: {next_cursor}")
                else:
                    next_cursor = None
                    
                # Stop if we've reached the limit
                if effective_limit and blocks_processed >= effective_limit:
                    logger.info(f"Reached limit of {effective_limit} blocks")
                    break
                    
        except asyncio.TimeoutError:
            logger.error(f"Timeout retrieving blocks for page {page_id}")
            # Return partial content instead of failing completely
            logger.info(f"Returning partial content with {len(blocks)} blocks")
            
        logger.info(f"Successfully processed {len(blocks)} blocks")
        
        response_data = {
            "page": page_info,
            "blocks": blocks,
            "has_more": has_more,
            "next_cursor": next_cursor,
            "total_loaded": blocks_processed,
            "debug_info": {
                "total_batches": (blocks_processed // 100) + 1,
                "blocks_with_sequence": len([b for b in blocks if "_sequence" in b]),
                "first_block_sequence": blocks[0].get("_sequence") if blocks else None,
                "last_block_sequence": blocks[-1].get("_sequence") if blocks else None,
                "request_cursor": cursor,
                "response_cursor": next_cursor
            }
        }
        
        # Add pagination info for debugging
        if cursor is None:
            logger.info(f"Initial load: returned {len(blocks)} blocks")
        else:
            logger.info(f"Subsequent load: returned {len(blocks)} blocks with cursor {cursor}")
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error getting page content for API: {e}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# 添加获取页面块内容的端点 - 使用异步版本
@app.get("/api/blocks/{page_id}")
async def get_blocks(page_id: str):
    try:
        logger.info(f"Fetching blocks for page: {page_id}")
        headers = {
            "Authorization": f"Bearer {os.getenv('NOTION_TOKEN')}",
            "Notion-Version": "2022-06-28"
        }
        
        # Use async HTTP client with timeout
        timeout = httpx.Timeout(30.0)  # 30 second timeout
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                f"https://api.notion.com/v1/blocks/{page_id}/children",
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"Notion API returned {response.status_code}: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"Notion API error: {response.text}")
                
            return response.json()
            
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching blocks for page {page_id}")
        raise HTTPException(status_code=504, detail="Timeout fetching blocks from Notion API")
    except Exception as e:
        logger.error(f"Error fetching blocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 添加专门的增量加载更多内容的端点
@app.get("/api/page/{page_id}/more")
async def get_more_blocks(page_id: str, cursor: str, limit: Optional[int] = 20):
    """
    获取页面的更多块内容 - 用于增量加载避免API限制
    """
    try:
        logger.info(f"Fetching more blocks for page {page_id} with cursor {cursor}, limit={limit}")
        
        import asyncio
        from functools import partial
        
        blocks = []
        has_more = True
        next_cursor = cursor
        blocks_processed = 0
        
        logger.info(f"Loading more blocks with limit={limit}")
        try:
            while has_more and blocks_processed < limit:
                # Wrap block children list call with timeout
                loop = asyncio.get_event_loop()
                
                # Build API parameters
                api_params = {
                    "block_id": page_id,
                    "start_cursor": next_cursor,
                    "page_size": min(100, limit - blocks_processed)
                }
                
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, partial(notion.blocks.children.list, **api_params)),
                    timeout=20.0  # 20 second timeout for blocks
                )
                
                current_blocks = response["results"]
                logger.info(f"Retrieved {len(current_blocks)} more blocks")
                
                # Process blocks in the exact order received from Notion API
                batch_processed_blocks = []
                for i, block in enumerate(current_blocks):
                    if blocks_processed >= limit:
                        break
                        
                    logger.info(f"Processing additional block {i+1}/{len(current_blocks)}, type: {block['type']}, id: {block.get('id', 'unknown')}")
                    processed_block = process_block_content(block)
                    if processed_block:
                        # Add sequence information to help with ordering
                        processed_block["_sequence"] = blocks_processed
                        processed_block["_cursor_batch"] = next_cursor[:10] if next_cursor else "initial"  # Identifier for this batch
                        batch_processed_blocks.append(processed_block)
                        blocks_processed += 1
                
                # Add batch to blocks list while preserving order
                blocks.extend(batch_processed_blocks)
                logger.info(f"Added {len(batch_processed_blocks)} processed blocks to output (total additional: {blocks_processed})")
                
                has_more = response["has_more"]
                if has_more:
                    next_cursor = response["next_cursor"]
                    logger.info(f"More blocks still available, next_cursor: {next_cursor}")
                else:
                    next_cursor = None
                    
                # Stop if we've reached the limit
                if blocks_processed >= limit:
                    logger.info(f"Reached limit of {limit} additional blocks")
                    break
                    
        except asyncio.TimeoutError:
            logger.error(f"Timeout retrieving more blocks for page {page_id}")
            logger.info(f"Returning partial additional content with {len(blocks)} blocks")
            
        logger.info(f"Successfully processed {len(blocks)} additional blocks")
        
        return {
            "blocks": blocks,
            "has_more": has_more,
            "next_cursor": next_cursor,
            "total_loaded": blocks_processed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting more blocks for page {page_id}: {e}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/notion/page/{page_id}")
async def get_notion_page(page_id: str):
    """直接返回 Notion API 的原始页面数据"""
    try:
        page_data = notion.pages.retrieve(page_id=page_id)
        return page_data
    except Exception as e:
        logger.error(f"Error retrieving page {page_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notion/database/query")
async def query_notion_database(
    filter: Optional[dict] = None,
    sorts: Optional[List[dict]] = None,
    start_cursor: Optional[str] = None,
    page_size: Optional[int] = None
):
    """直接返回 Notion API 的原始数据库查询结果"""
    try:
        query = {}
        if filter:
            query["filter"] = filter
        if sorts:
            query["sorts"] = sorts
        if start_cursor:
            query["start_cursor"] = start_cursor
        if page_size:
            query["page_size"] = page_size

        logger.info(f"Querying database with params: {query}")
        response = notion.databases.query(
            database_id=DATABASE_ID,
            **query
        )
        return response
    except Exception as e:
        logger.error(f"Error querying database: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug/database")
async def get_database_raw():
    """获取数据库原始数据，用于调试"""
    try:
        logger.info("Getting raw database data for debugging...")
        response = notion.databases.query(
            database_id=DATABASE_ID,
            page_size=100  # 设置较大的页面大小以获取更多数据
        )
        
        # 记录原始数据
        logger.info("Database raw response:")
        logger.info(response)
        
        # 记录每个页面的关键属性
        for page in response.get('results', []):
            logger.info("\nPage details:")
            logger.info(f"ID: {page.get('id')}")
            logger.info(f"Properties: {page.get('properties')}")
            
        return {
            "total_results": len(response.get('results', [])),
            "has_more": response.get('has_more', False),
            "results": response.get('results', [])
        }
    except Exception as e:
        logger.error(f"Error getting raw database: {str(e)}")
        logger.error("Stack trace:", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/validate/{page_id}")
async def validate_page(page_id: str):
    """验证页面是否存在和可访问"""
    try:
        if not notion:
            raise HTTPException(status_code=503, detail="Notion client not initialized")
            
        logger.info(f"Validating page: {page_id}")
        
        # 使用简单的页面检索来验证
        import asyncio
        from functools import partial
        
        try:
            loop = asyncio.get_event_loop()
            page = await asyncio.wait_for(
                loop.run_in_executor(None, partial(notion.pages.retrieve, page_id=page_id)),
                timeout=10.0  # 短超时用于快速验证
            )
            
            # 检查页面是否被隐藏
            properties = page.get("properties", {})
            hidden = properties.get("Hidden", {}).get("select", {}).get("name") == "True"
            
            if hidden:
                return {
                    "valid": False,
                    "reason": "Page is hidden",
                    "page_id": page_id
                }
            
            # 获取基本信息
            title = "Untitled"
            if "Name" in properties:
                title_array = properties["Name"]["title"]
                if title_array and len(title_array) > 0:
                    title = title_array[0]["text"]["content"]
            elif "title" in properties:
                title_array = properties["title"]["title"]  
                if title_array and len(title_array) > 0:
                    title = title_array[0]["text"]["content"]
            
            return {
                "valid": True,
                "page_id": page_id,
                "title": title,
                "last_edited": page.get("last_edited_time"),
                "has_cover": bool(page.get("cover"))
            }
            
        except asyncio.TimeoutError:
            logger.error(f"Timeout validating page {page_id}")
            raise HTTPException(status_code=504, detail=f"Timeout validating page {page_id}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating page {page_id}: {e}")
        if "object not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=f"Page {page_id} not found")
        elif "unauthorized" in str(e).lower():
            raise HTTPException(status_code=403, detail="Access denied to this page")
        else:
            raise HTTPException(status_code=500, detail=f"Error validating page: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 