from typing import Any

class DummyFeature:
    def __init__(self):
        self.managed_by_flash = False
        self.available = False
        self.current_provider = None

class DummyFeatures:
    def __init__(self):
        self.flash_auth_present = False
        self.web = DummyFeature()
        self.browser = DummyFeature()

def get_flash_subscription_features(config: Any) -> DummyFeatures:
    return DummyFeatures()

def apply_flash_managed_defaults(config: Any) -> Any:
    return config

def prompt_enable_tool_gateway(config: Any) -> bool:
    return False
