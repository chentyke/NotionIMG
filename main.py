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

def process_block_content(block):
    try:
        block_type = block["type"]
        block_id = block["id"]
        has_children = block["has_children"]
        
        # Process rich text content
        def process_rich_text(rich_text):
            if not rich_text:
                return ""
            return process_rich_text_with_formatting(rich_text)
        
        # Get children blocks if any
        children = []
        if has_children:
            response = notion.blocks.children.list(block_id=block_id)
            for child in response["results"]:
                processed_child = process_block_content(child)
                if processed_child:
                    children.append(processed_child)
        
        result = {
            "type": block_type,
            "has_children": has_children,
            "children": children if has_children else None
        }
        
        # Process block content based on type
        if block_type == "paragraph":
            result["text"] = process_rich_text(block["paragraph"]["rich_text"])
            result["color"] = block["paragraph"].get("color", "default")
        elif block_type == "heading_1":
            result["text"] = process_rich_text(block["heading_1"]["rich_text"])
            result["color"] = block["heading_1"].get("color", "default")
        elif block_type == "heading_2":
            result["text"] = process_rich_text(block["heading_2"]["rich_text"])
            result["color"] = block["heading_2"].get("color", "default")
        elif block_type == "heading_3":
            result["text"] = process_rich_text(block["heading_3"]["rich_text"])
            result["color"] = block["heading_3"].get("color", "default")
        elif block_type == "bulleted_list_item":
            result["text"] = process_rich_text(block["bulleted_list_item"]["rich_text"])
            result["color"] = block["bulleted_list_item"].get("color", "default")
            if has_children:
                result["children"] = children
        elif block_type == "numbered_list_item":
            result["text"] = process_rich_text(block["numbered_list_item"]["rich_text"])
            result["color"] = block["numbered_list_item"].get("color", "default")
            if has_children:
                result["children"] = children
        elif block_type == "to_do":
            result["text"] = process_rich_text(block["to_do"]["rich_text"])
            result["checked"] = block["to_do"]["checked"]
        elif block_type == "toggle":
            result["toggle"] = {
                "rich_text": block["toggle"]["rich_text"],
                "color": block["toggle"].get("color", "default")
            }
        elif block_type == "child_page":
            result["title"] = block["child_page"]["title"]
            result["page_id"] = block_id
        elif block_type == "image":
            image_block = block["image"]
            result["image_url"] = image_block["file"]["url"] if image_block["type"] == "file" else image_block["external"]["url"]
            caption = image_block.get("caption", [])
            result["caption"] = process_rich_text(caption) if caption else None
        elif block_type == "code":
            result["text"] = process_rich_text(block["code"]["rich_text"])
            result["language"] = block["code"]["language"]
        elif block_type == "quote":
            result["text"] = process_rich_text(block["quote"]["rich_text"])
        elif block_type == "callout":
            result["text"] = process_rich_text(block["callout"]["rich_text"])
            result["icon"] = block["callout"].get("icon")
        elif block_type == "divider":
            pass  # No additional processing needed
        elif block_type == "bookmark":
            result["url"] = block["bookmark"]["url"]
            caption = block["bookmark"].get("caption", [])
            result["caption"] = process_rich_text(caption) if caption else None
        elif block_type == "equation":
            result["expression"] = block["equation"]["expression"]
        elif block_type == "video":
            video_block = block["video"]
            result["video_url"] = video_block["file"]["url"] if video_block["type"] == "file" else video_block["external"]["url"]
        elif block_type == "file":
            file_block = block["file"]
            result["file_url"] = file_block["file"]["url"] if file_block["type"] == "file" else file_block["external"]["url"]
            caption = file_block.get("caption", [])
            result["caption"] = process_rich_text(caption) if caption else None
        elif block_type == "pdf":
            pdf_block = block["pdf"]
            result["pdf_url"] = pdf_block["file"]["url"] if pdf_block["type"] == "file" else pdf_block["external"]["url"]
        elif block_type == "embed":
            result["url"] = block["embed"]["url"]
        elif block_type == "table":
            result["has_column_header"] = block["table"].get("has_column_header", False)
            result["has_row_header"] = block["table"].get("has_row_header", False)
            result["children"] = []
            if has_children:
                rows_response = notion.blocks.children.list(block_id=block_id)
                for row in rows_response["results"]:
                    if row["type"] == "table_row":
                        cells = []
                        for cell in row["table_row"]["cells"]:
                            cells.append(process_rich_text(cell))
                        result["children"].append({"cells": cells})
        
        return result
    except Exception as e:
        logger.error(f"Error processing block {block.get('id', 'unknown')}: {e}")
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