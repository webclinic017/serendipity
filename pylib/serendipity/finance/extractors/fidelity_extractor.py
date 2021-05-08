from datetime import datetime
import re
from typing import List

from serendipity.extractor import Document
from serendipity.gen.finance.models import Statement

from .statement_extractor import CsvStatementExtractor 

class FidelityExtractor(CsvStatementExtractor, institutionName="Fidelity"):
    _accountRe: re.Pattern = re.compile("Account Number:[\s]+([\w-]+)")
    _dateRe: re.Pattern = re.compile("INVESTMENT REPORT[\s]+([\w ,-]+)")
    _dateFmt: str  = '%B %d, %Y'
    _initialized: bool = False

    def __init__(self, doc: Document):
        super().__init__(doc)

    def statements(self) -> List[Statement]:
        account_number = self.extractString(self._accountRe, self._doc.text())
        date = self.extractString(self._dateRe, self._doc.text())
        dates = date.split('-')
        if len(dates) != 2:
            raise RuntimeError("Error parsing dates") 

        s = Statement(account_number=account_number, 
            start_date=datetime.strptime(dates[0].strip(), self._dateFmt).isoformat(),
            end_date=datetime.strptime(dates[1].strip(), self._dateFmt).isoformat(),
            institution_name=self.institutionName()
        )
        return [ s ]

    @classmethod
    def canProcess(cls, document: Document) -> bool:
        text:str = document.text()
        return text.find("Fidelity") >= 0 and text.find("Investment Report")
