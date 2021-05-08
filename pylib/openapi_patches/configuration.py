class Configuration(object):
    def __init__(self):
        self.client_side_validation = True
        self.verify_ssl = False

    @staticmethod
    def get_default_copy():
        return Configuration()
