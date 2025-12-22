export function parseWKBPoint(wkb: string): [number, number] | null {
  // WKB Hex String
  // Example: 0101000020E6100000...
  // 0-1: Byte Order (01 = Little Endian)
  // 2-9: Type (01000020 = Point + SRID) -> 0x20000001
  // 10-17: SRID (E6100000 -> 4326)
  // 18-33: X (double)
  // 34-49: Y (double)
  
  if (!wkb || wkb.length < 50) return null;

  try {
    const buffer = Buffer.from(wkb, 'hex');
    const isLittleEndian = buffer.readUInt8(0) === 1;
    const type = isLittleEndian ? buffer.readUInt32LE(1) : buffer.readUInt32BE(1);
    
    // Check if it's a Point (1) with SRID (0x20000000 bit set)
    // PostGIS usually returns EWKB with SRID
    // Type 1 = Point.
    // EWKB Point = 0x20000001
    
    let offset = 5;
    if (type & 0x20000000) {
       // SRID present, skip 4 bytes
       offset += 4;
    }

    const x = isLittleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
    const y = isLittleEndian ? buffer.readDoubleLE(offset + 8) : buffer.readDoubleBE(offset + 8);
    
    return [x, y];
  } catch (e) {
    console.error('Error parsing WKB:', e);
    return null;
  }
}
