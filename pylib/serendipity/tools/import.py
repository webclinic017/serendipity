import os
import sys

module_root=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
sys.path.append(module_root)

from serendipity.utils import App
from serendipity.finance.tools.statement_organizer import StatementOrganizer

class Import(App):
    def __init__(self):
        super().__init__("Imports data into serendipity")
        self._parser.add_argument("--type", "-t", type=str, help="The type of data to process. Can currently only be finance", default="finance")
        self._parser.add_argument("--file", "-f", type=str, help="The file to process", required=True)

    def start(self, args: []):
        super().start(args)
        o = StatementOrganizer(self._config)
        o.organize(self._parsedArgs.file)

if __name__  == "__main__":
    i = Import()
    i.start(sys.argv[1:])
