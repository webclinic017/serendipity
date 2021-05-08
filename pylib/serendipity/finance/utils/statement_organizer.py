from datetime import datetime
import os
import pathlib
import shutil

from serendipity.gen.serendipity_config.models import SerendipityConfig, Finance

from ..extractors import createCsvStatementExtractor

class StatementOrganizer:
    _path: str

    def __init__(self, config: SerendipityConfig):
        self._path = config.finance.document_path

    def organize(self, filepath: str):
        extractor = createCsvStatementExtractor(filepath)
        sig = extractor.statement()
        newName = extractor.normalizedStatementFileName()
        year = datetime.fromisoformat(sig.end_date).strftime("%Y")
        filename, fileExtension = os.path.splitext(filepath)
        dirPath = pathlib.Path(self._path) / "finance" / "statements" / year
        newFilepath = dirPath / (newName + fileExtension)
        pathlib.Path(dirPath).mkdir(parents=True, exist_ok=True)
        shutil.copyfile(filepath, newFilepath)
