from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from notion_client import Client
import os
import logging
from typing import List, Dict, Optional

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
            
        return {
            "id": page["id"],
            "title": title,
            "created_time": page["created_time"],
            "last_edited_time": page["last_edited_time"],
            "parent_id": page.get("parent", {}).get("page_id")
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
        # First try to get the block to check if it's a child page
        try:
            block = notion.blocks.retrieve(block_id=page_id)
            if block["type"] == "child_page":
                # If it's a child page, use the title from the block
                page_info = {
                    "id": block["id"],
                    "title": block["child_page"]["title"],
                    "created_time": block["created_time"],
                    "last_edited_time": block["last_edited_time"],
                    "parent_id": block["parent"]["page_id"] if block["parent"]["type"] == "page_id" else None
                }
            else:
                # If it's not a child page, get page metadata normally
                page = notion.pages.retrieve(page_id=page_id)
                page_info = get_page_info(page)
        except Exception as e:
            # If block retrieval fails, try page retrieval as fallback
            page = notion.pages.retrieve(page_id=page_id)
            page_info = get_page_info(page)
            if page_info and "parent" in page and page["parent"]["type"] == "page_id":
                page_info["parent_id"] = page["parent"]["page_id"]
        
        if not page_info:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Get page blocks
        blocks = []
        has_more = True
        cursor = None
        
        while has_more:
            if cursor:
                response = notion.blocks.children.list(block_id=page_id, start_cursor=cursor)
            else:
                response = notion.blocks.children.list(block_id=page_id)
            
            for block in response["results"]:
                processed_block = process_block_content(block)
                if processed_block:
                    blocks.append(processed_block)
            
            has_more = response["has_more"]
            if has_more:
                cursor = response["next_cursor"]
        
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 