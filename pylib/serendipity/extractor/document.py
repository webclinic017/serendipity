import pandas

class Document:
    _extensionMap:dict = {}
    _extension:str = ""

    def __init__(self, filepath: str):
        self._filepath = filepath

    def __init_subclass__(cls, extension: str, **kwargs):
        super().__init_subclass__(**kwargs)
        cls._extensionMap[extension] = cls
        cls._extension = extension

    @property
    def filepath(self) -> str:
        return self._filepath
    
    @property
    def extension(self) -> str:
        return self._extension

    @property
    def isPdf(self) -> bool:
        return self._extension == "pdf"
    
    @property
    def isCsv(self) -> bool:
        return self._extension == "csv"

    def text(self) -> str:
        """
            Return the entire document in textual form
        """
        raise NotImplementedError

    def extractTable(
        self, 
        tableName: str, 
        firstColumnName:str =  "",
        firstColumnIndex:int = -1,
        lastColumnName:str = "",
        lastColumnIndex:int = -1,
        tableEndMarker:str = ""
    ) -> pandas.DataFrame:
        """
            Return a specific table
        """
        raise NotImplementedError

    def extractSingleTable(self) -> pandas.DataFrame:
        """
            Extract from a document that consists of a single table 
        """
        raise NotImplementedError

