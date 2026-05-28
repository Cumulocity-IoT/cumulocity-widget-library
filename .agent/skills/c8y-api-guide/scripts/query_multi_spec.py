import requests
import yaml
import sys
import json

# Mapping of scopes to their official YAML links
SPECS = {
    "core": "https://cumulocity.com/api/core/dist/c8y-oas.yml",
    "datahub": "https://cumulocity.com/api/datahub/dist/c8y-datahub-oas.yml",
    "dtm": "https://cumulocity.com/api/dtm/dist/c8y-dtm-oas.yml"
}

def query_spec(scope, search_term):
    url = SPECS.get(scope.lower())
    if not url:
        return json.dumps({"error": f"Invalid scope: {scope}. Choose from core, datahub, or dtm."})

    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        spec = yaml.safe_load(response.text)
        
        results = {"scope": scope, "endpoints": [], "schemas": []}
        search_term = search_term.lower()

        # Search Paths
        for path, methods in spec.get('paths', {}).items():
            for method, details in methods.items():
                if not isinstance(details, dict):
                    continue
                if search_term in path.lower() or search_term in str(details.get('tags', [])).lower():
                    results["endpoints"].append({
                        "path": path,
                        "method": method.upper(),
                        "summary": details.get('summary'),
                        "parameters": details.get('parameters', [])
                    })

        # Search Schemas
        for name, schema in spec.get('components', {}).get('schemas', {}).items():
            if search_term in name.lower():
                results["schemas"].append({name: schema})

        return json.dumps(results, indent=2)[:5000] # Limit output for token efficiency

    except Exception as e:
        return json.dumps({"error": f"Failed to fetch {scope} spec: {str(e)}"})

if __name__ == "__main__":
    # Usage: python query_multi_spec.py <scope> <query>
    scope_arg = sys.argv[1] if len(sys.argv) > 1 else "core"
    query_arg = sys.argv[2] if len(sys.argv) > 2 else ""
    print(query_spec(scope_arg, query_arg))