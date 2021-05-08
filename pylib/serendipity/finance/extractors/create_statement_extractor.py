from ...extractor import createDocument, Document
from .statement_extractor import CsvStatementExtractor

# Institution extractors
from .chase_extractor import ChaseExtractor
from .fidelity_extractor import FidelityExtractor
from .merrill_edge_extractor import MerrillEdgeCsvHoldingsExtractor, MerrillEdgeCsvTransactionsExtractor

def createCsvStatementExtractor(filepath: str, name: str = "") -> CsvStatementExtractor:
    doc = createDocument(filepath)
    CsvStatementExtractorClass: CsvStatementExtractor
    for CsvStatementExtractorClass in CsvStatementExtractor.subclasses():
        if (len(name) > 0 and CsvStatementExtractorClass.institutionName() == name) or CsvStatementExtractorClass.canProcess(doc):
            return CsvStatementExtractorClass(doc)
    return None
