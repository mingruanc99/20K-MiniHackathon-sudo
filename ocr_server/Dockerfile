# CPU-only VietOCR region OCR service. ~2.5 GB image (torch CPU + ~400 MB ONNX/weights).
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git git-lfs libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* && git lfs install

WORKDIR /srv
# Model code + weights (Apache-2.0 deepdoc code; weights are git-lfs objects).
ARG DEEPDOC_REF=main
RUN git clone --depth 1 --branch ${DEEPDOC_REF} https://github.com/hoaivannguyen/deepdoc_vietocr.git deepdoc_vietocr \
    && rm -rf deepdoc_vietocr/.git deepdoc_vietocr/img deepdoc_vietocr/log

COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY server.py .
ENV DEEPDOC_DIR=/srv/deepdoc_vietocr \
    OMP_NUM_THREADS=2 \
    PORT=8765
EXPOSE 8765
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
