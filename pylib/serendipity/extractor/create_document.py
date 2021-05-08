import os

from .document import  Document
from .csv_document import CsvDocument
from .excel_document import ExcelDocument
from .pdf_document import PdfDocument

def createDocument(filepath: str) -> Document:
    n, ext = os.path.splitext(filepath)
    if ext is None:
        raise RuntimeError(f"File extension could not be determined for {filepath}")
    if ext.startswith("."):
        ext = ext[1:]
    if ext not in Document._extensionMap:
        raise NotImplementedError(f"Document for {ext} not found")

    return Document._extensionMap[ext](filepath)
