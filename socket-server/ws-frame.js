// WebSocket 프레임 파싱
// https://datatracker.ietf.org/doc/html/rfc6455#section-5.2

export const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

/**
 * 버퍼에서 프레임 하나 읽기
 * 아직 다 안 왔으면 null을 반환한다.
 */
export function parseFrame(buf) {
  // 최소 2바이트는 있어야 헤더를 읽는다.
  if (buf.length < 2) return null;

  const fin = (buf[0] & 0b1000_0000) !== 0;
  const opcode = buf[0] & 0b0000_1111;
  const masked = (buf[1] & 0b1000_0000) !== 0;

  let payloadLen = buf[1] & 0b0111_1111;
  let offset = 2;

  // 길이 필드가 확장되는 경우
  if (payloadLen === 126) {
    if (buf.length < offset + 2) return null;
    payloadLen = buf.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLen === 127) {
    if (buf.length < offset + 8) return null;
    // 8바이트 길이. 4GB 넘을 일은 없으니 Number로 변환
    payloadLen = Number(buf.readBigUInt64BE(offset));
    offset += 8;
  }

  // 마스크 키 4바이트
  let maskKey = null;
  if (masked) {
    if (buf.length < offset + 4) return null;
    maskKey = buf.subarray(offset, offset + 4);
    offset += 4;
  }

  // 본문이 다 왔는지 확인
  if (buf.length < offset + payloadLen) return null;

  const payload = Buffer.from(buf.subarray(offset, offset + payloadLen));

  // 마스킹 해제: payload[i] XOR maskKey[i % 4]
  if (masked) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return {
    fin,
    opcode,
    payload,
    frameLength: offset + payloadLen,
  };
}

/**
 * 텍스트 프레임을 만든다.
 * 서버 → 클라이언트는 마스킹하지 않는다 (명세)
 */
export function buildFrame(text, opcode = OPCODE.TEXT) {
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;

  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  header[0] = 0b1000_0000 | opcode; // FIN=1 + opcode

  return Buffer.concat([header, payload]);
}
