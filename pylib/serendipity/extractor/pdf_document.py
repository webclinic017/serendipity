import camelot
from pdfminer.high_level import extract_text

from .document import Document

class PdfDocument(Document, extension="pdf"):
    """
    Helper class to wrap high level PDF functionality 
    such as extracting data or obfuscation
    """
    def __init__(self, filepath: str):
        super().__init__(filepath)
        self._allText = None
        self._tables = None

    def text(self) -> str:
        if (self._allText is None):
            self._allText = extract_text(self._filepath)
        return self._allText

    def tables(self):
        if self._tables is None:
            self._tables = camelot.read_pdf(filepath=self._filepath, 
                pages="all", 
                flavor="stream",
                suppress_stdout=True)
        return self._tables
    