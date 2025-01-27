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

# Initialize Notion client
notion = Client(auth=os.environ.get("NOTION_TOKEN"))
DATABASE_ID = os.environ.get("NOTION_DATABASE_ID")

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"Response: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        raise

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

# 添加页面模型
class Page(BaseModel):
    id: str
    title: str
    last_edited_time: str
    suffix: Optional[str] = None

# 存储页面数据的字典
pages_data = {}
suffix_pages = {}

@app.get("/")
async def read_root():
    return FileResponse("static/pages.html")

@app.get("/page/{page_id}")
async def read_page(page_id: str):
    return FileResponse("static/page.html")

@app.get("/{suffix}")
async def read_suffix_pages(suffix: str):
    try:
        logger.info(f"Accessing suffix route: {suffix}")
        # 检查是否有页面使用该 suffix
        if suffix not in suffix_pages:
            logger.warning(f"Suffix not found: {suffix}")
            raise HTTPException(status_code=404, detail="Suffix not found")
            
        pages = suffix_pages[suffix]
        if len(pages) > 1:
            logger.info(f"Multiple pages found for suffix {suffix}, returning list page")
            return FileResponse("static/suffix_pages.html")
        elif len(pages) == 1:
            logger.info(f"Single page found for suffix {suffix}, returning page")
            return FileResponse("static/page.html")
        else:
            logger.warning(f"No pages found for suffix {suffix}")
            raise HTTPException(status_code=404, detail="No pages found for this suffix")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing suffix route {suffix}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pages")
async def get_pages(suffix: Optional[str] = None):
    try:
        if suffix:
            logger.info(f"Getting pages with suffix: {suffix}")
            pages = suffix_pages.get(suffix, [])
            logger.info(f"Found {len(pages)} pages with suffix {suffix}")
            return pages
        return list(pages_data.values())
    except Exception as e:
        logger.error(f"Error getting pages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/page/{page_id}")
async def get_page(page_id: str):
    try:
        # 获取页面数据
        headers = {
            "Authorization": f"Bearer {os.getenv('NOTION_TOKEN')}",
            "Notion-Version": "2022-06-28"
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.notion.com/v1/pages/{page_id}",
                headers=headers
            )
            page_data = response.json()
            logger.info(f"Raw page data: {page_data}")  # 添加调试日志
            
            # 提取页面属性
            properties = page_data.get('properties', {})
            logger.info(f"Page properties: {properties}")  # 添加调试日志
            
            # 获取标题
            title = ''
            title_obj = properties.get('title', properties.get('Name', {}))
            if title_obj and title_obj.get('title'):
                title = title_obj['title'][0].get('plain_text', 'Untitled')
            
            # 获取 suffix
            suffix = ''
            suffix_obj = properties.get('suffix', {})
            logger.info(f"Suffix object: {suffix_obj}")  # 添加调试日志
            
            # 处理不同类型的 suffix 属性
            if suffix_obj:
                prop_type = suffix_obj.get('type', '')
                logger.info(f"Suffix property type: {prop_type}")  # 添加属性类型日志
                
                if prop_type == 'rich_text':
                    rich_text = suffix_obj.get('rich_text', [])
                    if rich_text and len(rich_text) > 0:
                        suffix = rich_text[0].get('plain_text', '')
                elif prop_type == 'text':
                    text = suffix_obj.get('text', '')
                    if isinstance(text, str):
                        suffix = text
                    elif isinstance(text, dict):
                        suffix = text.get('content', '')
                else:
                    logger.warning(f"Unexpected suffix property type: {prop_type}")

            logger.info(f"Extracted suffix: {suffix}")  # 添加调试日志

            # 如果提取失败，尝试其他可能的位置
            if not suffix and isinstance(suffix_obj, dict):
                # 尝试直接获取内容
                if 'content' in suffix_obj:
                    suffix = suffix_obj['content']
                elif 'plain_text' in suffix_obj:
                    suffix = suffix_obj['plain_text']

            logger.info(f"Final suffix value: {suffix}")  # 添加最终值日志
            
            # 获取其他属性
            last_edited_time = page_data.get('last_edited_time', '')
            
            # 更新页面数据
            page = Page(
                id=page_id,
                title=title,
                last_edited_time=last_edited_time,
                suffix=suffix
            )
            pages_data[page_id] = page.dict()
            
            # 更新 suffix 索引
            if suffix:
                logger.info(f"Adding page {page_id} with suffix {suffix}")
                if suffix not in suffix_pages:
                    suffix_pages[suffix] = []
                # 检查是否已存在
                existing_page = next((p for p in suffix_pages[suffix] if p['id'] == page_id), None)
                if not existing_page:
                    suffix_pages[suffix].append(page.dict())
            
            return page_data
    except Exception as e:
        logger.error(f"Error getting page {page_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 添加获取页面块内容的端点
@app.get("/api/blocks/{page_id}")
async def get_blocks(page_id: str):
    try:
        headers = {
            "Authorization": f"Bearer {os.getenv('NOTION_TOKEN')}",
            "Notion-Version": "2022-06-28"
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.notion.com/v1/blocks/{page_id}/children",
                headers=headers
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 