FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY knowledge ./knowledge
COPY .cursor ./.cursor
COPY data ./data
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV DISPUTE_DATA_DIR=/tmp/dispute-letters-data

EXPOSE 8000

CMD ["./start.sh"]
