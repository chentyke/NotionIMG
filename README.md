# Notion Image Bed

A FastAPI-based image hosting service that reads images from your Notion database. This service allows you to use Notion as an image hosting platform by accessing images stored in your Notion database.

## Setup

1. Create a Notion integration and get your integration token:
   - Go to https://www.notion.so/my-integrations
   - Create a new integration
   - Copy the integration token

2. Share your Notion database with the integration:
   - Open your Notion database
   - Click the "..." menu in the top right
   - Click "Add connections"
   - Select your integration

3. Get your database ID:
   - Open your database in Notion
   - The database ID is the part of the URL after the workspace name and before the question mark
   - Example: `https://www.notion.so/workspace/1234567890abcdef1234567890abcdef`
   - Database ID would be: `1234567890abcdef1234567890abcdef`

4. Set up environment variables:
   - Copy the `.env.example` file to `.env`
   - Fill in your Notion integration token and database ID

## Installation

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows, use: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the Server

```bash
uvicorn main:app --reload
```

The server will start at `http://localhost:8000`

## API Endpoints

- `GET /`: Welcome message
- `GET /images`: List all images from the Notion database
- `GET /image/{image_id}`: Get a specific image by its block ID (redirects to the actual image URL)

## Usage

1. Store images in your Notion database
2. Access the `/images` endpoint to get a list of all available images
3. Use the `/image/{image_id}` endpoint to access specific images

## Notes

- The image URLs from Notion are temporary and expire after a certain time
- Make sure your Notion database has a "type" property that can be used to filter images

## Features

### Code Block Features
- Syntax highlighting for various programming languages
- One-click code copying
  - Hover over any code block to reveal a "Copy" button in the top-right corner
  - Click to copy the code to your clipboard
  - Visual feedback confirms successful copy operation 