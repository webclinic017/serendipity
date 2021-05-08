from datetime import datetime
import os
import re
from typing import List

from ...extractor import createDocument, Document
from ...gen.finance.models import Statement

class CsvStatementExtractor:
    """
    Extracts data from financial institution statements
    """

    _subclasses = []
    _organization = None
    _doc: Document
    _institutionName: str

    def __init__(self, doc: Document):
        self._doc = doc

    def __init_subclass__(cls, institutionName: str, **kwargs):
        super().__init_subclass__(**kwargs)
        cls._institutionName = institutionName
        cls._subclasses.append(cls)

    def normalizedStatementFileName(self) -> str:
        """
        Returns the normalized file name for a statement using its signature
        """
        statements = self.statements()
        s = statements[0]
        start_date_str = datetime.fromisoformat(s.start_date).strftime("%Y%m%d")
        end_date_str = datetime.fromisoformat(s.end_date).strftime("%Y%m%d")
        redacted_account_nums = []
        for sig in sigArray:
            redacted_account_num = sig.account_number[-4:]
            redacted_account_num = redacted_account_num.rjust(len(s.account_number) - len(redacted_account_num), 'X')
            redacted_account_nums.append(redacted_account_num)
        redacted_account_nums.sort()
        return f"{s.institution_name}_{redacted_account_nums.join('_')}_{start_date_str}_{end_date_str}"

    def statement(self) -> Statement:
        return self.statements()[0]

    def statements(self) -> List[Statement]:
        """
        Processes the imported data into a Statement object for each account.
        """
        raise NotImplementedError

    @classmethod
    def institutionName(cls):
        return cls._institutionName
        
    @classmethod
    def subclasses(cls):
        return cls._subclasses

    @staticmethod 
    def extractString(regex: re.Pattern, s: str):
        """
        Extract a string from a single capture group 
        """
        m = regex.search(s)
        if m is None:
            return None
        g = m.groups()
        if len(g) != 1:
            return None 
        return g[0]

    @classmethod
    def canProcess(cls, document: Document) -> bool:
        """
        Returns True if this document can be processed by this CsvStatementExtractor,
        False otherwise
        """
        raise NotImplementedError      
