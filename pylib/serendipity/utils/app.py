import argparse
import json
import pathlib

from serendipity.gen.serendipity_config import ApiClient
from serendipity.gen.serendipity_config.models import SerendipityConfig

class App:
    _parser: argparse.ArgumentParser
    _config: SerendipityConfig
    _parsedArgs: argparse.Namespace

    def __init__(self, desc: str):
        self._parser = argparse.ArgumentParser(description=desc)
        default_config_path = pathlib.Path.home() / ".serendipity/config.json"
        self._parser.add_argument("--config", "-c", help="Path to configuration file", type=str, default=default_config_path)

    def start(self, args: []):
        self._parsedArgs = self._parser.parse_args(args)
        with open(self._parsedArgs.config, 'r') as f:
            data = json.load(f)
            client = ApiClient()
            self._config = client.deserialize_data(data, SerendipityConfig)

    @property
    def parser(self)  -> argparse.ArgumentParser:
        return self._parser
