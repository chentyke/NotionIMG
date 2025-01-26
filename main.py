from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from notion_client import Client
import os
import logging
from typing import List, Dict, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
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

@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")

def get_file_info(page: dict) -> dict:
    """Extract file information from a Notion page."""
    try:
        title = page["properties"]["Name"]["title"][0]["text"]["content"]
        content = page["properties"].get("Content", {}).get("files", [])
        
        if not content:
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
        title = page["properties"]["Name"]["title"][0]["text"]["content"]
        return {
            "id": page["id"],
            "title": title,
            "created_time": page["created_time"],
            "last_edited_time": page["last_edited_time"]
        }
    except (KeyError, IndexError) as e:
        logger.warning(f"Error extracting page info: {e}")
        return None

def process_block_content(block: dict) -> dict:
    """Process block content to extract relevant information."""
    block_type = block["type"]
    content = block[block_type]
    
    if "rich_text" in content:
        text_content = "".join([text["plain_text"] for text in content["rich_text"]])
    else:
        text_content = ""
    
    result = {
        "id": block["id"],
        "type": block_type,
        "text": text_content,
        "has_children": block["has_children"]
    }
    
    # Handle specific block types
    if block_type == "image":
        result["image_url"] = content.get("file", {}).get("url", "")
    elif block_type == "code":
        result["language"] = content.get("language", "")
    elif block_type == "callout":
        result["icon"] = content.get("icon", {})
    elif block_type == "child_page":
        # 获取子页面信息
        try:
            child_page = notion.pages.retrieve(page_id=block["id"])
            result["title"] = child_page["properties"]["Name"]["title"][0]["text"]["content"]
            result["page_id"] = block["id"]  # 使用块 ID 作为页面 ID
        except Exception as e:
            logger.error(f"Error retrieving child page info: {e}")
            result["title"] = "Untitled"
            result["page_id"] = block["id"]
    elif block_type == "child_database":
        # 处理子数据库
        try:
            child_db = notion.databases.retrieve(database_id=block["id"])
            result["title"] = child_db["title"][0]["plain_text"]
            result["database_id"] = block["id"]
        except Exception as e:
            logger.error(f"Error retrieving child database info: {e}")
            result["title"] = "Untitled Database"
            result["database_id"] = block["id"]
    
    return result

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
        # Get page metadata
        page = notion.pages.retrieve(page_id=page_id)
        page_info = get_page_info(page)
        
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
                block_content = process_block_content(block)
                
                # 只为非子页面类型的块获取子内容
                if block["has_children"] and block["type"] not in ["child_page", "child_database"]:
                    try:
                        child_blocks = []
                        child_cursor = None
                        child_has_more = True
                        
                        while child_has_more:
                            if child_cursor:
                                child_response = notion.blocks.children.list(
                                    block_id=block["id"],
                                    start_cursor=child_cursor
                                )
                            else:
                                child_response = notion.blocks.children.list(block_id=block["id"])
                            
                            for child_block in child_response["results"]:
                                child_content = process_block_content(child_block)
                                # 如果子块也有子内容且不是子页面，递归获取
                                if child_block["has_children"] and child_block["type"] not in ["child_page", "child_database"]:
                                    child_content["children"] = await get_block_children(child_block["id"])
                                child_blocks.append(child_content)
                            
                            child_has_more = child_response["has_more"]
                            if child_has_more:
                                child_cursor = child_response["next_cursor"]
                        
                        block_content["children"] = child_blocks
                    except Exception as e:
                        logger.error(f"Error getting children for block {block['id']}: {e}")
                        block_content["children"] = []
                
                blocks.append(block_content)
            
            has_more = response["has_more"]
            if has_more:
                cursor = response["next_cursor"]
        
        return {
            "page": page_info,
            "blocks": blocks
        }
        
    except Exception as e:
        logger.error(f"Error retrieving page {page_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_block_children(block_id: str) -> List[dict]:
    """Recursively get all children of a block."""
    try:
        children = []
        cursor = None
        has_more = True
        
        while has_more:
            if cursor:
                response = notion.blocks.children.list(
                    block_id=block_id,
                    start_cursor=cursor
                )
            else:
                response = notion.blocks.children.list(block_id=block_id)
            
            for block in response["results"]:
                block_content = process_block_content(block)
                # 只为非子页面类型的块获取子内容
                if block["has_children"] and block["type"] not in ["child_page", "child_database"]:
                    block_content["children"] = await get_block_children(block["id"])
                children.append(block_content)
            
            has_more = response["has_more"]
            if has_more:
                cursor = response["next_cursor"]
        
        return children
    except Exception as e:
        logger.error(f"Error getting children for block {block_id}: {e}")
        return []

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