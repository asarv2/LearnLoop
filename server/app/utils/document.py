"""
Document processing utilities for PDF handling and content extraction
"""

import base64
import io
import logging
import os
from typing import Any

import httpx
import PyPDF2
from pdf2image import convert_from_bytes

logger = logging.getLogger(__name__)


def convert_pdf_to_images(
    pdf_base64: str, max_pages: int | None = None
) -> list[str]:
    """
    Convert PDF base64 data to a list of image base64 strings.

    Args:
        pdf_base64: Base64 encoded PDF data
        max_pages: Maximum number of pages to convert (default: None = all pages)

    Returns:
        List of base64 encoded image strings (PNG format)
    """
    try:
        # Decode the base64 PDF data
        pdf_bytes = base64.b64decode(pdf_base64)

        # Convert PDF pages to images
        if max_pages is None:
            # Convert all pages
            images = convert_from_bytes(
                pdf_bytes,
                dpi=150,  # Good quality but not too large
                fmt="PNG",
            )
        else:
            # Convert specific number of pages
            images = convert_from_bytes(
                pdf_bytes,
                first_page=1,
                last_page=max_pages,
                dpi=150,  # Good quality but not too large
                fmt="PNG",
            )

        # Convert images to base64
        image_base64_list = []
        for i, image in enumerate(images):
            # Convert PIL Image to bytes
            img_buffer = io.BytesIO()
            image.save(img_buffer, format="PNG")
            img_bytes = img_buffer.getvalue()

            # Convert to base64
            img_base64 = base64.b64encode(img_bytes).decode("utf-8")
            image_base64_list.append(img_base64)

            logger.info(f"Converted PDF page {i+1} to image")

        return image_base64_list

    except Exception as e:
        logger.error(f"Error converting PDF to images: {e}")
        return []


async def get_document_base64_and_content(
    document_id: str, db_session: Any
) -> dict[str, str]:
    """Get document PDF as base64 string and extract content, saving to database."""
    from sqlmodel import select

    from app.models import Documents

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SERVICE_ROLE_KEY")
    bucket_name = "documents"

    if not all([supabase_url, service_role_key]):
        logger.error("Missing Supabase configuration environment variables")
        raise ValueError("Supabase configuration incomplete")

    # Download the document from Supabase Storage
    file_key = f"{document_id}.pdf"
    storage_url = f"{supabase_url}/storage/v1/object/{bucket_name}/{file_key}"

    headers = {
        "Authorization": f"Bearer {service_role_key}",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(storage_url, headers=headers)
            response.raise_for_status()

            # Convert PDF content to base64
            pdf_base64 = base64.b64encode(response.content).decode("utf-8")

            # Extract text content using PyPDF2
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(response.content))
            extracted_text = ""
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"

            # Save extracted content to database
            try:
                document = db_session.exec(
                    select(Documents).where(Documents.id == document_id)
                ).one_or_none()

                if document:
                    document.content = extracted_text.strip()
                    db_session.add(document)
                    db_session.commit()
                    logger.info(
                        f"Updated document {document_id} with extracted PDF content"
                    )
                else:
                    logger.warning(f"Document {document_id} not found in database")
            except Exception as e:
                logger.error(f"Error saving extracted content to database: {e}")

            return {"base64": pdf_base64, "content": extracted_text.strip()}

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Document {document_id} not found in storage.")
            else:
                raise ValueError(f"Failed to download document: {e.response.text}")
        except Exception as e:
            raise ValueError(f"Document processing error: {str(e)}")


async def upload_template_to_supabase_storage(
    template_code: str, scenario_id: str
) -> None:
    """Upload template Python code to Supabase Storage templates bucket."""
    # Get Supabase configuration from environment variables
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SERVICE_ROLE_KEY")
    bucket_name = "templates"

    logger.info(
        f"Supabase Storage config - url: {supabase_url}, service_key: {'***' if service_role_key else 'None'}"
    )

    if not all([supabase_url, service_role_key]):
        logger.error("Missing Supabase configuration environment variables")
        raise ValueError("Supabase configuration incomplete")

    # Upload template code to Supabase Storage using Storage API
    file_key = f"{scenario_id}.py"
    storage_url = f"{supabase_url}/storage/v1/object/{bucket_name}/{file_key}"

    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "text/x-python",
        "x-upsert": "true",  # Allow overwrite
    }

    # Use httpx client for async HTTP request
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            storage_url, content=template_code.encode("utf-8"), headers=headers
        )
        response.raise_for_status()

    logger.info(
        f"Successfully uploaded template {file_key} to Supabase Storage bucket {bucket_name}"
    )
