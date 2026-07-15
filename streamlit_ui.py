import streamlit as st
import requests
import json
import os

# Set page config for a cleaner look
st.set_page_config(page_title="Flash Agent", page_icon="⚡", layout="centered")

# --- MANUS-LIKE CUSTOM CSS ---
def inject_custom_css():
    st.markdown("""
    <style>
        /* Import Inter font */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        
        /* Base typography and background */
        html, body, [class*="css"]  {
            font-family: 'Inter', sans-serif !important;
        }
        
        .stApp {
            background-color: #f8f9fb;
            background-image: radial-gradient(circle at 50% -20%, #ffffff, #f8f9fb 80%);
            color: #111827;
        }
        
        /* Hide Streamlit Header & Footer */
        header {visibility: hidden;}
        footer {visibility: hidden;}
        .stDeployButton {display:none;}
        
        /* Center the main container more elegantly */
        .main .block-container {
            max-width: 800px;
            padding-top: 3rem;
            padding-bottom: 5rem;
        }
        
        /* Chat Input styling (Floating & Glassmorphic) */
        .stChatInputContainer {
            background-color: rgba(255, 255, 255, 0.8) !important;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
            border-radius: 24px !important;
            padding: 2px 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            margin-bottom: 20px;
        }
        .stChatInputContainer:focus-within {
            border: 1px solid rgba(0, 0, 0, 0.15) !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), 0 0 15px rgba(0, 0, 0, 0.03);
        }
        
        /* Chat bubbles */
        [data-testid="stChatMessage"] {
            background-color: transparent !important;
            padding: 1rem 0 !important;
            border-bottom: none !important;
        }
        
        /* Assistant bubble */
        [data-testid="stChatMessage"]:nth-child(even) {
            background-color: transparent !important;
        }
        
        /* Style the markdown text */
        [data-testid="stMarkdownContainer"] {
            line-height: 1.6;
            font-size: 15px;
            color: #374151;
        }
        
        /* User bubble specifically */
        [data-testid="stChatMessage"]:nth-child(odd) [data-testid="stMarkdownContainer"] {
            background-color: #ffffff;
            padding: 12px 18px;
            border-radius: 18px;
            display: inline-block;
            border: 1px solid rgba(0, 0, 0, 0.06);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
            color: #111827;
        }
        
        /* Custom UI Text */
        .premium-title {
            font-size: 32px;
            font-weight: 500;
            text-align: center;
            background: -webkit-linear-gradient(45deg, #111827, #6b7280);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0;
            padding-bottom: 5px;
            letter-spacing: -0.5px;
        }
        .premium-subtitle {
            font-size: 14px;
            color: #6b7280;
            text-align: center;
            margin-top: 0;
            margin-bottom: 3rem;
            font-weight: 400;
        }
    </style>
    """, unsafe_allow_html=True)

inject_custom_css()

# --- STATE INITIALIZATION ---
if "messages" not in st.session_state:
    st.session_state.messages = []

# --- MAIN CHAT AREA ---
st.markdown("<div class='premium-title'>Flash Agent</div>", unsafe_allow_html=True)
st.markdown("<div class='premium-subtitle'>What can I help you build today?</div>", unsafe_allow_html=True)

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Chat input
if prompt := st.chat_input("Message Flash..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        url = "http://localhost:8000/v1/chat/completions"
        api_key = "test-token-123-super-secure-key"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        # Don't filter any messages out now since we don't use a dummy UI greeting anymore
        api_messages = [{"role": m["role"], "content": m["content"]} for m in st.session_state.messages]
        
        payload = {
            "model": "flash-agent",
            "messages": api_messages,
            "stream": True
        }
        
        try:
            with requests.post(url, headers=headers, json=payload, stream=True) as response:
                if response.status_code != 200:
                    st.error(f"API Error: {response.status_code}")
                    st.error(response.text)
                else:
                    for line in response.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                data_str = line[6:]
                                if data_str == '[DONE]':
                                    break
                                try:
                                    data_json = json.loads(data_str)
                                    if 'choices' in data_json and len(data_json['choices']) > 0:
                                        delta = data_json['choices'][0].get('delta', {})
                                        if 'content' in delta:
                                            full_response += delta['content']
                                            message_placeholder.markdown(full_response + " ✧")
                                except json.JSONDecodeError:
                                    pass
                    
                    message_placeholder.markdown(full_response)
                    st.session_state.messages.append({"role": "assistant", "content": full_response})
                    
        except requests.exceptions.ConnectionError:
            st.error("Failed to connect. Is `flash gateway` running?")
        except Exception as e:
            st.error(f"Error: {str(e)}")
