import json
import urllib.error
import urllib.request
from typing import Optional, Dict, Any

class OpenClawUIBridge:
    """
    Bridge to communicate with SoloCore Console.
    Allows the OpenClaw agent to dynamically update the UI state.
    """
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.endpoint = f"{self.base_url}/api/v1/node-update"
        
        # Mapping of human-readable titles to node IDs
        # This should match the frontend's mockSkillNodes or actual configuration
        self.title_to_id_map = {
            "AI 爆款文章生成器": "l3-article-writer",
            "短视频脚本编排": "l3-video-script",
            "社交媒体": "l3-social-media",
            "数据分析": "l3-data-analysis",
            "市场调研": "l3-market-research",
            "竞品分析": "l3-competitor-analysis",
            "Docker 镜像构建": "l3-docker-build",
            "CI/CD 流水线": "l3-cicd-pipeline",
            "监控告警": "l3-monitoring",
            "加密货币异动监控": "l3-crypto-tracker"
        }

    def _post_json(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        request = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    def trigger_node(self, node_id: str, status: str, drawer_content: Optional[Dict[str, Any]] = None) -> bool:
        """
        Update the status of a specific node on the web console.

        :param node_id: The ID of the node to update (e.g., 'l3-article-writer').
        :param status: The new status ('idle', 'running', 'error').
        :param drawer_content: Optional dictionary to update the drawer content.
                               Format: {
                                   "capabilities": ["cap1", "cap2"],
                                   "useCases": [{"title": "t1", "summary": "s1"}],
                                   "inputs": [{"field": "f1", "type": "text|slider"}]
                               }
        :return: True if successful, False otherwise.
        """
        if status not in ['idle', 'running', 'error']:
            print(f"❌ Invalid status: {status}. Must be 'idle', 'running', or 'error'.")
            return False

        payload = {
            "nodeId": node_id,
            "status": status
        }

        if drawer_content:
            payload["drawerContent"] = drawer_content

        try:
            self._post_json(self.endpoint, payload)
            print(f"✅ Successfully updated node '{node_id}' to '{status}'.")
            return True
        except urllib.error.URLError as e:
            print(f"❌ Failed to update UI: {e}")
            return False

    def queue_node_execution(self, node_id: str, command: str) -> bool:
        try:
            self._post_json(
                f"{self.base_url}/api/v1/node-execute",
                {
                    "nodeId": node_id,
                    "command": command,
                },
            )
            print(f"✅ Queued execution for '{node_id}' with command '{command}'.")
            return True
        except urllib.error.URLError as e:
            print(f"❌ Failed to queue execution: {e}")
            return False

    def resolve_node_id_by_title(self, title: str) -> Optional[str]:
        """
        Resolve a human-readable title to its corresponding node ID.
        
        :param title: The human-readable title (e.g., '文章撰写').
        :return: The node ID if found, None otherwise.
        """
        return self.title_to_id_map.get(title)

    def trigger_title(self, title: str, status: str, drawer_content: Optional[Dict[str, Any]] = None) -> bool:
        """
        Update the status of a specific node using its human-readable title.
        
        :param title: The human-readable title (e.g., '文章撰写').
        :param status: The new status ('idle', 'running', 'error').
        :param drawer_content: Optional dictionary to update the drawer content.
        :return: True if successful, False otherwise.
        """
        node_id = self.resolve_node_id_by_title(title)
        if not node_id:
            print(f"❌ Could not resolve title '{title}' to a node ID.")
            return False
            
        return self.trigger_node(node_id, status, drawer_content)

# Example usage:
if __name__ == "__main__":
    bridge = OpenClawUIBridge()
    
    # Simulate a node starting to run
    bridge.trigger_node("l3-article-writer", "running")
    
    # Simulate an error
    # bridge.trigger_node("l3-docker-build", "error")
    
    # Simulate completion
    # bridge.trigger_node("l3-article-writer", "idle")
