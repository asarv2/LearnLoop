"""
LearnLoop Documents Service - Document Processing and Management

This service provides FastAPI endpoints for:
- Document upload and processing
- Document text extraction
- Document metadata management
- Health checks and service status
"""

import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
    ]
)

logger = logging.getLogger("documents_service")

# Create FastAPI app
app = FastAPI(
    title="LearnLoop Documents Service",
    description="Document processing and management service",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class DocumentInfo(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    status: str = "processed"

class DocumentResponse(BaseModel):
    success: bool
    message: str
    document: Optional[DocumentInfo] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

# In-memory storage for demo (replace with proper database in production)
documents_store: Dict[str, DocumentInfo] = {}

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with service information."""
    return {
        "service": "LearnLoop Documents Service",
        "version": "0.1.0",
        "status": "running"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service="documents",
        version="0.1.0"
    )

@app.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a document."""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Read file content
        content = await file.read()
        
        # Create document info
        doc_id = f"doc_{len(documents_store) + 1}"
        document_info = DocumentInfo(
            id=doc_id,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            size=len(content),
            status="processed"
        )
        
        # Store document info (in production, store actual content in database/storage)
        documents_store[doc_id] = document_info
        
        logger.info(f"Document uploaded: {file.filename} (ID: {doc_id})")
        
        return DocumentResponse(
            success=True,
            message=f"Document '{file.filename}' uploaded successfully",
            document=document_info
        )
        
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """List all uploaded documents."""
    return list(documents_store.values())

@app.get("/documents/{document_id}", response_model=DocumentInfo)
async def get_document(document_id: str):
    """Get document information by ID."""
    if document_id not in documents_store:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return documents_store[document_id]

@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document."""
    if document_id not in documents_store:
        raise HTTPException(status_code=404, detail="Document not found")
    
    del documents_store[document_id]
    logger.info(f"Document deleted: {document_id}")
    
    return {"success": True, "message": f"Document {document_id} deleted successfully"}

@app.post("/documents/{document_id}/extract-text")
async def extract_text(document_id: str):
    """Extract text from a document (placeholder implementation)."""
    if document_id not in documents_store:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = documents_store[document_id]
    
    # Placeholder text extraction
    # In production, implement actual text extraction based on file type
    extracted_text = f"Extracted text from {document.filename} (placeholder implementation)"
    
    return {
        "success": True,
        "document_id": document_id,
        "extracted_text": extracted_text,
        "message": "Text extraction completed (placeholder)"
    }

def main():
    """Main entry point for the documents service."""
    logger.info(f"Starting LearnLoop Documents Service on :8002")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8002,
        log_level="info",
        access_log=True,
    )

if __name__ == "__main__":
    main()
