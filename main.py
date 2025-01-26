from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from notion_client import Client
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Notion Image Bed",
    description="A simple image hosting service that reads images from Notion database"
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
    return {"message": "Welcome to Notion Image Bed"}

@app.get("/images")
async def list_images():
    try:
        if not DATABASE_ID:
            raise HTTPException(status_code=500, detail="Database ID not configured")
            
        # Query the database
        logger.info(f"Querying database: {DATABASE_ID}")
        response = notion.databases.query(
            database_id=DATABASE_ID
        )
        
        logger.info(f"Found {len(response['results'])} pages")
        
        images = []
        for page in response["results"]:
            try:
                # Get image from Content property
                content_files = page.get("properties", {}).get("Content", {}).get("files", [])
                type_value = page.get("properties", {}).get("type", {}).get("rich_text", [])
                
                # Check if type is "image"
                is_image_type = any(rt.get("plain_text", "").lower() == "image" for rt in type_value)
                
                if is_image_type and content_files:
                    for file in content_files:
                        title = page.get("properties", {}).get("Name", {}).get("title", [{}])[0].get("plain_text", "Untitled")
                        url = file.get("file", {}).get("url") or file.get("external", {}).get("url")
                        
                        if url:
                            logger.info(f"Found image: {title} - {url}")
                            image_data = {
                                "id": page["id"],
                                "title": title,
                                "url": url
                            }
                            images.append(image_data)
                
            except Exception as page_error:
                logger.error(f"Error processing page {page['id']}: {str(page_error)}")
                continue
        
        return {"images": images}
    except Exception as e:
        logger.error(f"Error in list_images: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/image/{image_id}")
async def get_image(image_id: str):
    try:
        # Get the page
        page = notion.pages.retrieve(page_id=image_id)
        
        # Get the latest image URL from Content property
        content_files = page.get("properties", {}).get("Content", {}).get("files", [])
        if not content_files:
            raise HTTPException(status_code=404, detail="No image found in this page")
        
        # Get the first image URL (since we store one image per page)
        file = content_files[0]
        image_url = file.get("file", {}).get("url") or file.get("external", {}).get("url")
        
        if not image_url:
            raise HTTPException(status_code=404, detail="Image URL not found")
        
        logger.info(f"Redirecting to fresh image URL: {image_url}")
        # Redirect to the actual image URL
        return RedirectResponse(url=image_url)
    except Exception as e:
        logger.error(f"Error in get_image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 