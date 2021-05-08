import math
import pandas as pd
import yahoo_fin.stock_info as stock_info
import yahoo_fin.options as options

class MarketData:

    @staticmethod 
    def getLastValidElement(r:pd.Series):
        for val in reversed(r):
            if not math.isnan(val):
                return val
        return None
        
    @classmethod
    def currentPrice(cls, symbol:str):
        df:pd.DataFrame = stock_info.get_data(symbol, end_date = pd.Timestamp.today() + pd.DateOffset(10))
        return cls.getLastValidElement(df.close)
