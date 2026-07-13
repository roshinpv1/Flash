import streamlit as st
import requests
import json
import os

st.set_page_config(page_title="Flash Agent UI", page_icon="⚡")

st.title("⚡ Flash Agent UI")
st.caption("Connected to local Flash Gateway API")

# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "assistant", "content": "Hello! I'm Flash Agent. How can I help you today?"}]

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Accept user input
if prompt := st.chat_input("Type your message here..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    # Display user message in chat message container
    with st.chat_message("user"):
        st.markdown(prompt)

    # Display assistant response in chat message container
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        # API connection details
        url = "http://localhost:8000/v1/chat/completions"
        api_key = "test-token-123-super-secure-key" # Ideally this should be loaded from env
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        # Prepare the payload using the conversation history
        # (Filtering out the initial UI greeting, as some local models' Jinja templates 
        # crash if the conversation starts with an 'assistant' message)
        api_messages = [
            {"role": m["role"], "content": m["content"]} 
            for m in st.session_state.messages 
            if not (m["role"] == "assistant" and m["content"].startswith("Hello! I'm Flash Agent"))
        ]
        
        payload = {
            "model": "flash-agent",
            "messages": api_messages,
            "stream": True # Using streaming for a better UI experience
        }
        
        try:
            with requests.post(url, headers=headers, json=payload, stream=True) as response:
                if response.status_code != 200:
                    st.error(f"Error: API returned status code {response.status_code}")
                    st.error(response.text)
                else:
                    # Process Server-Sent Events (SSE)
                    for line in response.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                data_str = line[6:] # Remove 'data: ' prefix
                                
                                if data_str == '[DONE]':
                                    break
                                    
                                try:
                                    data_json = json.loads(data_str)
                                    if 'choices' in data_json and len(data_json['choices']) > 0:
                                        delta = data_json['choices'][0].get('delta', {})
                                        if 'content' in delta:
                                            full_response += delta['content']
                                            # Render with a blinking cursor
                                            message_placeholder.markdown(full_response + "▌")
                                except json.JSONDecodeError:
                                    pass
                                    
                    # Final render without cursor
                    message_placeholder.markdown(full_response)
                    # Add assistant response to chat history
                    st.session_state.messages.append({"role": "assistant", "content": full_response})
                    
        except requests.exceptions.ConnectionError:
            st.error("Failed to connect to Flash Gateway. Make sure `flash gateway` is running on port 8000.")
        except Exception as e:
            st.error(f"An error occurred: {str(e)}")
