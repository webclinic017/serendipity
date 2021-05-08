#!/bin/bash

pylib_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd ${pylib_dir}

python3 -m unittest discover -v
