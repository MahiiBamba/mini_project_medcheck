from agent_data import fetch_recent_events
from agent_context_builder import build_context
from agent import run_agent

def main():
    pack_id = input("Enter pack_id: ")

    events = fetch_recent_events(pack_id)

    context = build_context(events)

    # Add pack_id if not already included
    context["pack_id"] = pack_id
    context["trigger"] = "manual"

    result = run_agent(context)

    print("\n--- AGENT OUTPUT ---")
    print(result)

if __name__ == "__main__":
    main()