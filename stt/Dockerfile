FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg git build-essential curl cmake && rm -rf /var/lib/apt/lists/*
RUN git config --global http.postBuffer 524288000 \
    && mkdir -p /opt/whisper && cd /opt/whisper \
    && git clone --depth 1 https://github.com/ggerganov/whisper.cpp . \
    && cmake -B build && cmake --build build --config Release
RUN mkdir -p /opt/whisper/models && curl -L -o /opt/whisper/models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 8002
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
