# Notion Image Bed

A FastAPI-based image hosting service that reads images and pages from your Notion database. This service allows you to use Notion as a content management platform, supporting rich text formatting, images, code blocks, and more.

## Features

### Content Display
- Rich text formatting (bold, italic, underline, strikethrough)
- Text colors and background colors
- Headings (H1, H2, H3)
- Lists (ordered and unordered)
- Code blocks with syntax highlighting
- Images with captions
- Quotes and callouts
- Tables
- Toggle blocks
- Links and bookmarks
- File attachments
- Embedded content (videos, PDFs)

### Image Features
- Lazy loading for better performance
- Image compression for faster loading
- Click to view full size in modal
- Image captions support
- Responsive image sizing

### Code Block Features
- Syntax highlighting for various programming languages
- Language label in top-left corner
- One-click code copying
- Copy button appears on hover
- Visual feedback for copy operations

### Navigation
- Back button to return to parent page or pages list
- Configurable back button visibility (using Back property)
- Breadcrumb-style navigation
- Child page support

### Page Information
- Page title
- Last edited time display
- Loading progress indicator
- Error handling and fallbacks

### Customization Properties
- `Back`: Control back button visibility (True/False, defaults to True)
- `Hidden`: Hide pages from listing (True/False)

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
- `GET /image/{image_id}`: Get a specific image by its block ID
- `GET /pages`: List all pages from the Notion database
- `GET /page/{page_id}`: Get a specific page content

## Notes

- The image URLs from Notion are temporary and expire after a certain time
- Make sure your Notion database has the following properties:
  - "type" (Select): Used to filter content types (page, image, file)
  - "Back" (Select): Optional, controls back button visibility
  - "Hidden" (Select): Optional, controls page visibility in listings 