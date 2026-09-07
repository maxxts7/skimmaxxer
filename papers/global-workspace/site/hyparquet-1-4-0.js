"use strict";
var hyparquet = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // hyparquet/src/hyparquet.js
  var hyparquet_exports = {};
  __export(hyparquet_exports, {
    asyncBufferFromFile: () => asyncBufferFromFile,
    asyncBufferFromUrl: () => asyncBufferFromUrl,
    parquetMetadata: () => parquetMetadata,
    parquetMetadataAsync: () => parquetMetadataAsync,
    parquetQuery: () => parquetQuery,
    parquetRead: () => parquetRead,
    parquetReadObjects: () => parquetReadObjects,
    parquetSchema: () => parquetSchema,
    snappyUncompress: () => snappyUncompress,
    toJson: () => toJson
  });

  // hyparquet/src/constants.js
  var ParquetType = [
    "BOOLEAN",
    "INT32",
    "INT64",
    "INT96",
    // deprecated
    "FLOAT",
    "DOUBLE",
    "BYTE_ARRAY",
    "FIXED_LEN_BYTE_ARRAY"
  ];
  var Encoding = [
    "PLAIN",
    void 0,
    "PLAIN_DICTIONARY",
    "RLE",
    "BIT_PACKED",
    // deprecated
    "DELTA_BINARY_PACKED",
    "DELTA_LENGTH_BYTE_ARRAY",
    "DELTA_BYTE_ARRAY",
    "RLE_DICTIONARY",
    "BYTE_STREAM_SPLIT"
  ];
  var FieldRepetitionType = [
    "REQUIRED",
    "OPTIONAL",
    "REPEATED"
  ];
  var ConvertedType = [
    "UTF8",
    "MAP",
    "MAP_KEY_VALUE",
    "LIST",
    "ENUM",
    "DECIMAL",
    "DATE",
    "TIME_MILLIS",
    "TIME_MICROS",
    "TIMESTAMP_MILLIS",
    "TIMESTAMP_MICROS",
    "UINT_8",
    "UINT_16",
    "UINT_32",
    "UINT_64",
    "INT_8",
    "INT_16",
    "INT_32",
    "INT_64",
    "JSON",
    "BSON",
    "INTERVAL"
  ];
  var CompressionCodec = [
    "UNCOMPRESSED",
    "SNAPPY",
    "GZIP",
    "LZO",
    "BROTLI",
    "LZ4",
    "ZSTD",
    "LZ4_RAW"
  ];
  var PageType = [
    "DATA_PAGE",
    "INDEX_PAGE",
    "DICTIONARY_PAGE",
    "DATA_PAGE_V2"
  ];

  // hyparquet/src/convert.js
  var dayMillis = 864e5;
  function convertWithDictionary(data, dictionary, schemaElement, encoding, utf8 = true) {
    if (dictionary && encoding.endsWith("_DICTIONARY")) {
      dictionary = convert(dictionary, schemaElement, utf8);
      let output = data;
      if (data instanceof Uint8Array && !(dictionary instanceof Uint8Array)) {
        output = new dictionary.constructor(data.length);
      }
      for (let i = 0; i < data.length; i++) {
        output[i] = dictionary[data[i]];
      }
      return output;
    } else {
      return convert(data, schemaElement, utf8);
    }
  }
  function convert(data, schemaElement, utf8 = true) {
    const ctype = schemaElement.converted_type;
    if (ctype === "DECIMAL") {
      const scale = schemaElement.scale || 0;
      const factor = Math.pow(10, -scale);
      const arr = new Array(data.length);
      for (let i = 0; i < arr.length; i++) {
        if (data[0] instanceof Uint8Array) {
          arr[i] = parseDecimal(data[i]) * factor;
        } else {
          arr[i] = Number(data[i]) * factor;
        }
      }
      return arr;
    }
    if (ctype === void 0 && schemaElement.type === "INT96") {
      return Array.from(data).map(parseInt96Date);
    }
    if (ctype === "DATE") {
      const arr = new Array(data.length);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = new Date(data[i] * dayMillis);
      }
      return arr;
    }
    if (ctype === "TIMESTAMP_MILLIS") {
      const arr = new Array(data.length);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = new Date(Number(data[i]));
      }
      return arr;
    }
    if (ctype === "TIMESTAMP_MICROS") {
      const arr = new Array(data.length);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = new Date(Number(data[i] / 1000n));
      }
      return arr;
    }
    if (ctype === "JSON") {
      const decoder = new TextDecoder();
      return data.map((v) => JSON.parse(decoder.decode(v)));
    }
    if (ctype === "BSON") {
      throw new Error("parquet bson not supported");
    }
    if (ctype === "INTERVAL") {
      throw new Error("parquet interval not supported");
    }
    if (ctype === "UTF8" || utf8 && schemaElement.type === "BYTE_ARRAY") {
      const decoder = new TextDecoder();
      const arr = new Array(data.length);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = data[i] && decoder.decode(data[i]);
      }
      return arr;
    }
    if (ctype === "UINT_64") {
      const arr = new BigUint64Array(data.length);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = BigInt(data[i]);
      }
      return arr;
    }
    if (schemaElement.logical_type?.type === "FLOAT16") {
      return Array.from(data).map(parseFloat16);
    }
    if (schemaElement.logical_type?.type === "TIMESTAMP") {
      const { unit } = schemaElement.logical_type;
      let factor = 1n;
      if (unit === "MICROS") factor = 1000n;
      if (unit === "NANOS") factor = 1000000n;
      const arr = new Array(data.length);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = new Date(Number(data[i] / factor));
      }
      return arr;
    }
    return data;
  }
  function parseDecimal(bytes) {
    let value = 0;
    for (const byte of bytes) {
      value = value << 8 | byte;
    }
    return value;
  }
  function parseInt96Date(value) {
    const days = Number((value >> 64n) - 2440588n);
    const nano = Number((value & 0xffffffffffffffffn) / 1000000n);
    const millis = days * dayMillis + nano;
    return new Date(millis);
  }
  function parseFloat16(bytes) {
    if (!bytes) return void 0;
    const int16 = bytes[1] << 8 | bytes[0];
    const sign = int16 >> 15 ? -1 : 1;
    const exp = int16 >> 10 & 31;
    const frac = int16 & 1023;
    if (exp === 0) return sign * Math.pow(2, -14) * (frac / 1024);
    if (exp === 31) return frac ? NaN : sign * Infinity;
    return sign * Math.pow(2, exp - 15) * (1 + frac / 1024);
  }

  // hyparquet/src/schema.js
  function schemaTree(schema, rootIndex, path) {
    const element = schema[rootIndex];
    const children = [];
    let count = 1;
    if (element.num_children) {
      while (children.length < element.num_children) {
        const childElement = schema[rootIndex + count];
        const child = schemaTree(schema, rootIndex + count, [...path, childElement.name]);
        count += child.count;
        children.push(child);
      }
    }
    return { count, element, children, path };
  }
  function getSchemaPath(schema, name) {
    let tree = schemaTree(schema, 0, []);
    const path = [tree];
    for (const part of name) {
      const child = tree.children.find((child2) => child2.element.name === part);
      if (!child) throw new Error(`parquet schema element not found: ${name}`);
      path.push(child);
      tree = child;
    }
    return path;
  }
  function getMaxRepetitionLevel(schemaPath) {
    let maxLevel = 0;
    for (const { element } of schemaPath) {
      if (element.repetition_type === "REPEATED") {
        maxLevel++;
      }
    }
    return maxLevel;
  }
  function getMaxDefinitionLevel(schemaPath) {
    let maxLevel = 0;
    for (const { element } of schemaPath.slice(1)) {
      if (element.repetition_type !== "REQUIRED") {
        maxLevel++;
      }
    }
    return maxLevel;
  }
  function isListLike(schema) {
    if (!schema) return false;
    if (schema.element.converted_type !== "LIST") return false;
    if (schema.children.length > 1) return false;
    const firstChild = schema.children[0];
    if (firstChild.children.length > 1) return false;
    if (firstChild.element.repetition_type !== "REPEATED") return false;
    return true;
  }
  function isMapLike(schema) {
    if (!schema) return false;
    if (schema.element.converted_type !== "MAP") return false;
    if (schema.children.length > 1) return false;
    const firstChild = schema.children[0];
    if (firstChild.children.length !== 2) return false;
    if (firstChild.element.repetition_type !== "REPEATED") return false;
    const keyChild = firstChild.children.find((child) => child.element.name === "key");
    if (keyChild?.element.repetition_type === "REPEATED") return false;
    const valueChild = firstChild.children.find((child) => child.element.name === "value");
    if (valueChild?.element.repetition_type === "REPEATED") return false;
    return true;
  }

  // hyparquet/src/thrift.js
  var CompactType = {
    STOP: 0,
    TRUE: 1,
    FALSE: 2,
    BYTE: 3,
    I16: 4,
    I32: 5,
    I64: 6,
    DOUBLE: 7,
    BINARY: 8,
    LIST: 9,
    SET: 10,
    MAP: 11,
    STRUCT: 12,
    UUID: 13
  };
  function deserializeTCompactProtocol(reader) {
    let lastFid = 0;
    const value = {};
    while (reader.offset < reader.view.byteLength) {
      const [type, fid, newLastFid] = readFieldBegin(reader, lastFid);
      lastFid = newLastFid;
      if (type === CompactType.STOP) {
        break;
      }
      value[`field_${fid}`] = readElement(reader, type);
    }
    return value;
  }
  function readElement(reader, type) {
    switch (type) {
      case CompactType.TRUE:
        return true;
      case CompactType.FALSE:
        return false;
      case CompactType.BYTE:
        return reader.view.getInt8(reader.offset++);
      case CompactType.I16:
      case CompactType.I32:
        return readZigZag(reader);
      case CompactType.I64:
        return readZigZagBigInt(reader);
      case CompactType.DOUBLE: {
        const value = reader.view.getFloat64(reader.offset, true);
        reader.offset += 8;
        return value;
      }
      case CompactType.BINARY: {
        const stringLength = readVarInt(reader);
        const strBytes = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, stringLength);
        reader.offset += stringLength;
        return strBytes;
      }
      case CompactType.LIST: {
        const [elemType, listSize] = readCollectionBegin(reader);
        const boolType = elemType === CompactType.TRUE || elemType === CompactType.FALSE;
        const values = new Array(listSize);
        for (let i = 0; i < listSize; i++) {
          values[i] = boolType ? readElement(reader, CompactType.BYTE) === 1 : readElement(reader, elemType);
        }
        return values;
      }
      case CompactType.STRUCT: {
        const structValues = {};
        let structLastFid = 0;
        while (true) {
          let structFieldType, structFid;
          [structFieldType, structFid, structLastFid] = readFieldBegin(reader, structLastFid);
          if (structFieldType === CompactType.STOP) {
            break;
          }
          structValues[`field_${structFid}`] = readElement(reader, structFieldType);
        }
        return structValues;
      }
      // TODO: MAP and SET
      case CompactType.UUID: {
        let uuid = "";
        for (let i = 0; i < 16; i++) {
          uuid += reader.view.getUint8(reader.offset++).toString(16).padStart(2, "0");
        }
        return uuid;
      }
      default:
        throw new Error(`thrift unhandled type: ${type}`);
    }
  }
  function readVarInt(reader) {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = reader.view.getUint8(reader.offset++);
      result |= (byte & 127) << shift;
      if (!(byte & 128)) {
        return result;
      }
      shift += 7;
    }
  }
  function readVarBigInt(reader) {
    let result = 0n;
    let shift = 0n;
    while (true) {
      const byte = reader.view.getUint8(reader.offset++);
      result |= BigInt(byte & 127) << shift;
      if (!(byte & 128)) {
        return result;
      }
      shift += 7n;
    }
  }
  function readZigZag(reader) {
    const zigzag = readVarInt(reader);
    return zigzag >>> 1 ^ -(zigzag & 1);
  }
  function readZigZagBigInt(reader) {
    const zigzag = readVarBigInt(reader);
    return zigzag >> BigInt(1) ^ -(zigzag & BigInt(1));
  }
  function getCompactType(byte) {
    return byte & 15;
  }
  function readFieldBegin(reader, lastFid) {
    const type = reader.view.getUint8(reader.offset++);
    if ((type & 15) === CompactType.STOP) {
      return [0, 0, lastFid];
    }
    const delta = type >> 4;
    let fid;
    if (delta) {
      fid = lastFid + delta;
    } else {
      throw new Error("non-delta field id not supported");
    }
    return [getCompactType(type), fid, fid];
  }
  function readCollectionBegin(reader) {
    const sizeType = reader.view.getUint8(reader.offset++);
    const size = sizeType >> 4;
    const type = getCompactType(sizeType);
    if (size === 15) {
      const newSize = readVarInt(reader);
      return [type, newSize];
    }
    return [type, size];
  }

  // hyparquet/src/metadata.js
  async function parquetMetadataAsync(asyncBuffer, initialFetchSize = 1 << 19) {
    if (!asyncBuffer) throw new Error("parquet file is required");
    if (!(asyncBuffer.byteLength >= 0)) throw new Error("parquet file byteLength is required");
    const footerOffset = Math.max(0, asyncBuffer.byteLength - initialFetchSize);
    const footerBuffer = await asyncBuffer.slice(footerOffset, asyncBuffer.byteLength);
    const footerView = new DataView(footerBuffer);
    if (footerView.getUint32(footerBuffer.byteLength - 4, true) !== 827474256) {
      throw new Error("parquet file invalid (footer != PAR1)");
    }
    const metadataLength = footerView.getUint32(footerBuffer.byteLength - 8, true);
    if (metadataLength > asyncBuffer.byteLength - 8) {
      throw new Error(`parquet metadata length ${metadataLength} exceeds available buffer ${asyncBuffer.byteLength - 8}`);
    }
    if (metadataLength + 8 > initialFetchSize) {
      const metadataOffset = asyncBuffer.byteLength - metadataLength - 8;
      const metadataBuffer = await asyncBuffer.slice(metadataOffset, footerOffset);
      const combinedBuffer = new ArrayBuffer(metadataLength + 8);
      const combinedView = new Uint8Array(combinedBuffer);
      combinedView.set(new Uint8Array(metadataBuffer));
      combinedView.set(new Uint8Array(footerBuffer), footerOffset - metadataOffset);
      return parquetMetadata(combinedBuffer);
    } else {
      return parquetMetadata(footerBuffer);
    }
  }
  function parquetMetadata(arrayBuffer) {
    if (!arrayBuffer) throw new Error("parquet file is required");
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 8) {
      throw new Error("parquet file is too short");
    }
    if (view.getUint32(view.byteLength - 4, true) !== 827474256) {
      throw new Error("parquet file invalid (footer != PAR1)");
    }
    const metadataLengthOffset = view.byteLength - 8;
    const metadataLength = view.getUint32(metadataLengthOffset, true);
    if (metadataLength > view.byteLength - 8) {
      throw new Error(`parquet metadata length ${metadataLength} exceeds available buffer ${view.byteLength - 8}`);
    }
    const metadataOffset = metadataLengthOffset - metadataLength;
    const reader = { view, offset: metadataOffset };
    const metadata = deserializeTCompactProtocol(reader);
    const decoder = new TextDecoder();
    function decode(value) {
      return value && decoder.decode(value);
    }
    const version = metadata.field_1;
    const schema = metadata.field_2.map((field) => ({
      type: ParquetType[field.field_1],
      type_length: field.field_2,
      repetition_type: FieldRepetitionType[field.field_3],
      name: decode(field.field_4),
      num_children: field.field_5,
      converted_type: ConvertedType[field.field_6],
      scale: field.field_7,
      precision: field.field_8,
      field_id: field.field_9,
      logical_type: logicalType(field.field_10)
    }));
    const columnSchema = schema.filter((e) => e.type);
    const num_rows = metadata.field_3;
    const row_groups = metadata.field_4.map((rowGroup) => ({
      columns: rowGroup.field_1.map((column, columnIndex) => ({
        file_path: decode(column.field_1),
        file_offset: column.field_2,
        meta_data: column.field_3 && {
          type: ParquetType[column.field_3.field_1],
          encodings: column.field_3.field_2?.map((e) => Encoding[e]),
          path_in_schema: column.field_3.field_3.map(decode),
          codec: CompressionCodec[column.field_3.field_4],
          num_values: column.field_3.field_5,
          total_uncompressed_size: column.field_3.field_6,
          total_compressed_size: column.field_3.field_7,
          key_value_metadata: column.field_3.field_8,
          data_page_offset: column.field_3.field_9,
          index_page_offset: column.field_3.field_10,
          dictionary_page_offset: column.field_3.field_11,
          statistics: convertStats(column.field_3.field_12, columnSchema[columnIndex]),
          encoding_stats: column.field_3.field_13?.map((encodingStat) => ({
            page_type: PageType[encodingStat.field_1],
            encoding: Encoding[encodingStat.field_2],
            count: encodingStat.field_3
          })),
          bloom_filter_offset: column.field_3.field_14,
          bloom_filter_length: column.field_3.field_15,
          size_statistics: column.field_3.field_16 && {
            unencoded_byte_array_data_bytes: column.field_3.field_16.field_1,
            repetition_level_histogram: column.field_3.field_16.field_2,
            definition_level_histogram: column.field_3.field_16.field_3
          }
        },
        offset_index_offset: column.field_4,
        offset_index_length: column.field_5,
        column_index_offset: column.field_6,
        column_index_length: column.field_7,
        crypto_metadata: column.field_7,
        encrypted_column_metadata: column.field_8
      })),
      total_byte_size: rowGroup.field_2,
      num_rows: rowGroup.field_3,
      sorting_columns: rowGroup.field_4?.map((sortingColumn) => ({
        column_idx: sortingColumn.field_1,
        descending: sortingColumn.field_2,
        nulls_first: sortingColumn.field_3
      })),
      file_offset: rowGroup.field_5,
      total_compressed_size: rowGroup.field_6,
      ordinal: rowGroup.field_7
    }));
    const key_value_metadata = metadata.field_5?.map((keyValue) => ({
      key: decode(keyValue.field_1),
      value: decode(keyValue.field_2)
    }));
    const created_by = decode(metadata.field_6);
    return {
      version,
      schema,
      num_rows,
      row_groups,
      key_value_metadata,
      created_by,
      metadata_length: metadataLength
    };
  }
  function parquetSchema(metadata) {
    return getSchemaPath(metadata.schema, [])[0];
  }
  function logicalType(logicalType2) {
    if (logicalType2?.field_1) return { type: "STRING" };
    if (logicalType2?.field_2) return { type: "MAP" };
    if (logicalType2?.field_3) return { type: "LIST" };
    if (logicalType2?.field_4) return { type: "ENUM" };
    if (logicalType2?.field_5) return {
      type: "DECIMAL",
      scale: logicalType2.field_5.field_1,
      precision: logicalType2.field_5.field_2
    };
    if (logicalType2?.field_6) return { type: "DATE" };
    if (logicalType2?.field_7) return {
      type: "TIME",
      isAdjustedToUTC: logicalType2.field_7.field_1,
      unit: timeUnit(logicalType2.field_7.field_2)
    };
    if (logicalType2?.field_8) return {
      type: "TIMESTAMP",
      isAdjustedToUTC: logicalType2.field_8.field_1,
      unit: timeUnit(logicalType2.field_8.field_2)
    };
    if (logicalType2?.field_10) return {
      type: "INTEGER",
      bitWidth: logicalType2.field_10.field_1,
      isSigned: logicalType2.field_10.field_2
    };
    if (logicalType2?.field_11) return { type: "NULL" };
    if (logicalType2?.field_12) return { type: "JSON" };
    if (logicalType2?.field_13) return { type: "BSON" };
    if (logicalType2?.field_14) return { type: "UUID" };
    if (logicalType2?.field_15) return { type: "FLOAT16" };
    return logicalType2;
  }
  function timeUnit(unit) {
    if (unit.field_1) return "MILLIS";
    if (unit.field_2) return "MICROS";
    if (unit.field_3) return "NANOS";
    throw new Error("parquet time unit required");
  }
  function convertStats(stats, schema) {
    return stats && {
      max: convertMetadata(stats.field_1, schema),
      min: convertMetadata(stats.field_2, schema),
      null_count: stats.field_3,
      distinct_count: stats.field_4,
      max_value: convertMetadata(stats.field_5, schema),
      min_value: convertMetadata(stats.field_6, schema),
      is_max_value_exact: stats.field_7,
      is_min_value_exact: stats.field_8
    };
  }
  function convertMetadata(value, schema) {
    const { type, converted_type, logical_type } = schema;
    if (value === void 0) return value;
    if (type === "BOOLEAN") return value[0] === 1;
    if (type === "BYTE_ARRAY") return new TextDecoder().decode(value);
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    if (type === "FLOAT" && view.byteLength === 4) return view.getFloat32(0, true);
    if (type === "DOUBLE" && view.byteLength === 8) return view.getFloat64(0, true);
    if (type === "INT32" && converted_type === "DATE") return new Date(view.getInt32(0, true) * 864e5);
    if (type === "INT64" && converted_type === "TIMESTAMP_MICROS") return new Date(Number(view.getBigInt64(0, true) / 1000n));
    if (type === "INT64" && converted_type === "TIMESTAMP_MILLIS") return new Date(Number(view.getBigInt64(0, true)));
    if (type === "INT64" && logical_type?.type === "TIMESTAMP") return new Date(Number(view.getBigInt64(0, true)));
    if (type === "INT32" && view.byteLength === 4) return view.getInt32(0, true);
    if (type === "INT64" && view.byteLength === 8) return view.getBigInt64(0, true);
    if (converted_type === "DECIMAL") return parseDecimal(value) * Math.pow(10, -(schema.scale || 0));
    if (logical_type?.type === "FLOAT16") return parseFloat16(value);
    if (type === "FIXED_LEN_BYTE_ARRAY") return value;
    return value;
  }

  // hyparquet/src/assemble.js
  function assembleLists(output, definitionLevels, repetitionLevels, values, repetitionPath, maxDefinitionLevel) {
    const n = definitionLevels?.length || repetitionLevels.length;
    let valueIndex = 0;
    const containerStack = [output];
    let currentContainer = output;
    let currentDepth = 0;
    let currentDefLevel = 0;
    let currentRepLevel = 0;
    if (repetitionLevels[0]) {
      while (currentDepth < repetitionPath.length - 2 && currentRepLevel < repetitionLevels[0]) {
        currentContainer = currentContainer.at(-1);
        containerStack.push(currentContainer);
        currentDepth++;
        if (repetitionPath[currentDepth] !== "REQUIRED") currentDefLevel++;
        if (repetitionPath[currentDepth] === "REPEATED") currentRepLevel++;
      }
    }
    for (let i = 0; i < n; i++) {
      const def = definitionLevels?.length ? definitionLevels[i] : maxDefinitionLevel;
      const rep = repetitionLevels[i];
      while (currentDepth && (rep < currentRepLevel || repetitionPath[currentDepth] !== "REPEATED")) {
        if (repetitionPath[currentDepth] !== "REQUIRED") {
          containerStack.pop();
          currentDefLevel--;
        }
        if (repetitionPath[currentDepth] === "REPEATED") currentRepLevel--;
        currentDepth--;
      }
      currentContainer = containerStack.at(-1);
      while ((currentDepth < repetitionPath.length - 2 || repetitionPath[currentDepth + 1] === "REPEATED") && (currentDefLevel < def || repetitionPath[currentDepth + 1] === "REQUIRED")) {
        currentDepth++;
        if (repetitionPath[currentDepth] !== "REQUIRED") {
          const newList = [];
          currentContainer.push(newList);
          currentContainer = newList;
          containerStack.push(newList);
          currentDefLevel++;
        }
        if (repetitionPath[currentDepth] === "REPEATED") currentRepLevel++;
      }
      if (def === maxDefinitionLevel) {
        currentContainer.push(values[valueIndex++]);
      } else if (currentDepth === repetitionPath.length - 2) {
        currentContainer.push(null);
      } else {
        currentContainer.push([]);
      }
    }
    if (!output.length) {
      for (let i = 0; i < maxDefinitionLevel; i++) {
        const newList = [];
        currentContainer.push(newList);
        currentContainer = newList;
      }
    }
    return output;
  }
  function assembleNested(subcolumnData, schema, depth = 0) {
    const path = schema.path.join(".");
    const optional = schema.element.repetition_type === "OPTIONAL";
    const nextDepth = optional ? depth + 1 : depth;
    if (isListLike(schema)) {
      let sublist = schema.children[0];
      let subDepth = nextDepth;
      if (sublist.children.length === 1) {
        sublist = sublist.children[0];
        subDepth++;
      }
      assembleNested(subcolumnData, sublist, subDepth);
      const subcolumn = sublist.path.join(".");
      const values = subcolumnData.get(subcolumn);
      if (!values) throw new Error("parquet list column missing values");
      if (optional) flattenAtDepth(values, depth);
      subcolumnData.set(path, values);
      subcolumnData.delete(subcolumn);
      return;
    }
    if (isMapLike(schema)) {
      const mapName = schema.children[0].element.name;
      assembleNested(subcolumnData, schema.children[0].children[0], nextDepth + 1);
      assembleNested(subcolumnData, schema.children[0].children[1], nextDepth + 1);
      const keys = subcolumnData.get(`${path}.${mapName}.key`);
      const values = subcolumnData.get(`${path}.${mapName}.value`);
      if (!keys) throw new Error("parquet map column missing keys");
      if (!values) throw new Error("parquet map column missing values");
      if (keys.length !== values.length) {
        throw new Error("parquet map column key/value length mismatch");
      }
      const out = assembleMaps(keys, values, nextDepth);
      if (optional) flattenAtDepth(out, depth);
      subcolumnData.delete(`${path}.${mapName}.key`);
      subcolumnData.delete(`${path}.${mapName}.value`);
      subcolumnData.set(path, out);
      return;
    }
    if (schema.children.length) {
      const invertDepth = schema.element.repetition_type === "REQUIRED" ? depth : depth + 1;
      const struct = {};
      for (const child of schema.children) {
        assembleNested(subcolumnData, child, invertDepth);
        const childData = subcolumnData.get(child.path.join("."));
        if (!childData) throw new Error("parquet struct missing child data");
        struct[child.element.name] = childData;
      }
      for (const child of schema.children) {
        subcolumnData.delete(child.path.join("."));
      }
      const inverted = invertStruct(struct, invertDepth);
      if (optional) flattenAtDepth(inverted, depth);
      subcolumnData.set(path, inverted);
    }
  }
  function flattenAtDepth(arr, depth) {
    for (let i = 0; i < arr.length; i++) {
      if (depth) {
        flattenAtDepth(arr[i], depth - 1);
      } else {
        arr[i] = arr[i][0];
      }
    }
  }
  function assembleMaps(keys, values, depth) {
    const out = [];
    for (let i = 0; i < keys.length; i++) {
      if (depth) {
        out.push(assembleMaps(keys[i], values[i], depth - 1));
      } else {
        if (keys[i]) {
          const obj = {};
          for (let j = 0; j < keys[i].length; j++) {
            const value = values[i][j];
            obj[keys[i][j]] = value === void 0 ? null : value;
          }
          out.push(obj);
        } else {
          out.push(void 0);
        }
      }
    }
    return out;
  }
  function invertStruct(struct, depth) {
    const keys = Object.keys(struct);
    const length = struct[keys[0]]?.length;
    const out = [];
    for (let i = 0; i < length; i++) {
      const obj = {};
      for (const key of keys) {
        if (struct[key].length !== length) throw new Error("parquet struct parsing error");
        obj[key] = struct[key][i];
      }
      if (depth) {
        out.push(invertStruct(obj, depth - 1));
      } else {
        out.push(obj);
      }
    }
    return out;
  }

  // hyparquet/src/encoding.js
  function bitWidth(value) {
    return 32 - Math.clz32(value);
  }
  function readRleBitPackedHybrid(reader, width, length, output) {
    if (!length) {
      reader.offset += 4;
    }
    let seen = 0;
    while (seen < output.length) {
      const header = readVarInt(reader);
      if (header & 1) {
        seen = readBitPacked(reader, header, width, output, seen);
      } else {
        const count = header >>> 1;
        readRle(reader, count, width, output, seen);
        seen += count;
      }
    }
  }
  function readRle(reader, count, bitWidth2, output, seen) {
    const width = bitWidth2 + 7 >> 3;
    let value = 0;
    for (let i = 0; i < width; i++) {
      value |= reader.view.getUint8(reader.offset++) << (i << 3);
    }
    for (let i = 0; i < count; i++) {
      output[seen + i] = value;
    }
  }
  function readBitPacked(reader, header, bitWidth2, output, seen) {
    let count = header >> 1 << 3;
    const mask = (1 << bitWidth2) - 1;
    let data = 0;
    if (reader.offset < reader.view.byteLength) {
      data = reader.view.getUint8(reader.offset++);
    } else if (mask) {
      throw new Error(`parquet bitpack offset ${reader.offset} out of range`);
    }
    let left = 8;
    let right = 0;
    while (count) {
      if (right > 8) {
        right -= 8;
        left -= 8;
        data >>>= 8;
      } else if (left - right < bitWidth2) {
        data |= reader.view.getUint8(reader.offset) << left;
        reader.offset++;
        left += 8;
      } else {
        if (seen < output.length) {
          output[seen++] = data >> right & mask;
        }
        count--;
        right += bitWidth2;
      }
    }
    return seen;
  }
  function byteStreamSplit(reader, count, type, typeLength) {
    const width = byteWidth(type, typeLength);
    const bytes = new Uint8Array(count * width);
    for (let b = 0; b < width; b++) {
      for (let i = 0; i < count; i++) {
        bytes[i * width + b] = reader.view.getUint8(reader.offset++);
      }
    }
    if (type === "FLOAT") return new Float32Array(bytes.buffer);
    else if (type === "DOUBLE") return new Float64Array(bytes.buffer);
    else if (type === "INT32") return new Int32Array(bytes.buffer);
    else if (type === "INT64") return new BigInt64Array(bytes.buffer);
    else if (type === "FIXED_LEN_BYTE_ARRAY") {
      const split = new Array(count);
      for (let i = 0; i < count; i++) {
        split[i] = bytes.subarray(i * width, (i + 1) * width);
      }
      return split;
    }
    throw new Error(`parquet byte_stream_split unsupported type: ${type}`);
  }
  function byteWidth(type, typeLength) {
    switch (type) {
      case "INT32":
      case "FLOAT":
        return 4;
      case "INT64":
      case "DOUBLE":
        return 8;
      case "FIXED_LEN_BYTE_ARRAY":
        if (!typeLength) throw new Error("parquet byteWidth missing type_length");
        return typeLength;
      default:
        throw new Error(`parquet unsupported type: ${type}`);
    }
  }

  // hyparquet/src/plain.js
  function readPlain(reader, type, count, fixedLength) {
    if (count === 0) return [];
    if (type === "BOOLEAN") {
      return readPlainBoolean(reader, count);
    } else if (type === "INT32") {
      return readPlainInt32(reader, count);
    } else if (type === "INT64") {
      return readPlainInt64(reader, count);
    } else if (type === "INT96") {
      return readPlainInt96(reader, count);
    } else if (type === "FLOAT") {
      return readPlainFloat(reader, count);
    } else if (type === "DOUBLE") {
      return readPlainDouble(reader, count);
    } else if (type === "BYTE_ARRAY") {
      return readPlainByteArray(reader, count);
    } else if (type === "FIXED_LEN_BYTE_ARRAY") {
      if (!fixedLength) throw new Error("parquet missing fixed length");
      return readPlainByteArrayFixed(reader, count, fixedLength);
    } else {
      throw new Error(`parquet unhandled type: ${type}`);
    }
  }
  function readPlainBoolean(reader, count) {
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
      const byteOffset = reader.offset + (i / 8 | 0);
      const bitOffset = i % 8;
      const byte = reader.view.getUint8(byteOffset);
      values[i] = (byte & 1 << bitOffset) !== 0;
    }
    reader.offset += Math.ceil(count / 8);
    return values;
  }
  function readPlainInt32(reader, count) {
    const values = (reader.view.byteOffset + reader.offset) % 4 ? new Int32Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 4)) : new Int32Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
    reader.offset += count * 4;
    return values;
  }
  function readPlainInt64(reader, count) {
    const values = (reader.view.byteOffset + reader.offset) % 8 ? new BigInt64Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 8)) : new BigInt64Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
    reader.offset += count * 8;
    return values;
  }
  function readPlainInt96(reader, count) {
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
      const low = reader.view.getBigInt64(reader.offset + i * 12, true);
      const high = reader.view.getInt32(reader.offset + i * 12 + 8, true);
      values[i] = BigInt(high) << 64n | low;
    }
    reader.offset += count * 12;
    return values;
  }
  function readPlainFloat(reader, count) {
    const values = (reader.view.byteOffset + reader.offset) % 4 ? new Float32Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 4)) : new Float32Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
    reader.offset += count * 4;
    return values;
  }
  function readPlainDouble(reader, count) {
    const values = (reader.view.byteOffset + reader.offset) % 8 ? new Float64Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 8)) : new Float64Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
    reader.offset += count * 8;
    return values;
  }
  function readPlainByteArray(reader, count) {
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
      const length = reader.view.getInt32(reader.offset, true);
      reader.offset += 4;
      values[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, length);
      reader.offset += length;
    }
    return values;
  }
  function readPlainByteArrayFixed(reader, count, fixedLength) {
    const values = new Array(count);
    for (let i = 0; i < count; i++) {
      values[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, fixedLength);
      reader.offset += fixedLength;
    }
    return values;
  }
  function align(buffer, offset, size) {
    const aligned = new ArrayBuffer(size);
    new Uint8Array(aligned).set(new Uint8Array(buffer, offset, size));
    return aligned;
  }

  // hyparquet/src/snappy.js
  var WORD_MASK = [0, 255, 65535, 16777215, 4294967295];
  function copyBytes(fromArray, fromPos, toArray, toPos, length) {
    for (let i = 0; i < length; i++) {
      toArray[toPos + i] = fromArray[fromPos + i];
    }
  }
  function selfCopyBytes(array, pos, offset, length) {
    for (let i = 0; i < length; i++) {
      array[pos + i] = array[pos - offset + i];
    }
  }
  function snappyUncompress(input, output) {
    const inputLength = input.byteLength;
    const outputLength = output.byteLength;
    let pos = 0;
    let outPos = 0;
    while (pos < inputLength) {
      const c = input[pos];
      pos++;
      if (c < 128) {
        break;
      }
    }
    if (outputLength && pos >= inputLength) {
      throw new Error("invalid snappy length header");
    }
    while (pos < inputLength) {
      const c = input[pos];
      let len = 0;
      pos++;
      if (pos >= inputLength) {
        throw new Error("missing eof marker");
      }
      if ((c & 3) === 0) {
        let len2 = (c >>> 2) + 1;
        if (len2 > 60) {
          if (pos + 3 >= inputLength) {
            throw new Error("snappy error literal pos + 3 >= inputLength");
          }
          const lengthSize = len2 - 60;
          len2 = input[pos] + (input[pos + 1] << 8) + (input[pos + 2] << 16) + (input[pos + 3] << 24);
          len2 = (len2 & WORD_MASK[lengthSize]) + 1;
          pos += lengthSize;
        }
        if (pos + len2 > inputLength) {
          throw new Error("snappy error literal exceeds input length");
        }
        copyBytes(input, pos, output, outPos, len2);
        pos += len2;
        outPos += len2;
      } else {
        let offset = 0;
        switch (c & 3) {
          case 1:
            len = (c >>> 2 & 7) + 4;
            offset = input[pos] + (c >>> 5 << 8);
            pos++;
            break;
          case 2:
            if (inputLength <= pos + 1) {
              throw new Error("snappy error end of input");
            }
            len = (c >>> 2) + 1;
            offset = input[pos] + (input[pos + 1] << 8);
            pos += 2;
            break;
          case 3:
            if (inputLength <= pos + 3) {
              throw new Error("snappy error end of input");
            }
            len = (c >>> 2) + 1;
            offset = input[pos] + (input[pos + 1] << 8) + (input[pos + 2] << 16) + (input[pos + 3] << 24);
            pos += 4;
            break;
          default:
            break;
        }
        if (offset === 0 || isNaN(offset)) {
          throw new Error(`invalid offset ${offset} pos ${pos} inputLength ${inputLength}`);
        }
        if (offset > outPos) {
          throw new Error("cannot copy from before start of buffer");
        }
        selfCopyBytes(output, outPos, offset, len);
        outPos += len;
      }
    }
    if (outPos !== outputLength) throw new Error("premature end of input");
  }

  // hyparquet/src/datapage.js
  function readDataPage(bytes, daph, schemaPath, { type }) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const reader = { view, offset: 0 };
    let dataPage;
    const repetitionLevels = readRepetitionLevels(reader, daph, schemaPath);
    const { definitionLevels, numNulls } = readDefinitionLevels(reader, daph, schemaPath);
    const nValues = daph.num_values - numNulls;
    if (daph.encoding === "PLAIN") {
      const { type_length } = schemaPath[schemaPath.length - 1].element;
      dataPage = readPlain(reader, type, nValues, type_length);
    } else if (daph.encoding === "PLAIN_DICTIONARY" || daph.encoding === "RLE_DICTIONARY" || daph.encoding === "RLE") {
      const bitWidth2 = type === "BOOLEAN" ? 1 : view.getUint8(reader.offset++);
      if (bitWidth2) {
        dataPage = new Array(nValues);
        readRleBitPackedHybrid(reader, bitWidth2, view.byteLength - reader.offset, dataPage);
      } else {
        dataPage = new Uint8Array(nValues);
      }
    } else if (daph.encoding === "BYTE_STREAM_SPLIT") {
      const { type_length } = schemaPath[schemaPath.length - 1].element;
      dataPage = byteStreamSplit(reader, nValues, type, type_length);
    } else {
      throw new Error(`parquet unsupported encoding: ${daph.encoding}`);
    }
    return { definitionLevels, repetitionLevels, dataPage };
  }
  function readDictionaryPage(bytes, diph, columnMetadata, typeLength) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const reader = { view, offset: 0 };
    return readPlain(reader, columnMetadata.type, diph.num_values, typeLength);
  }
  function readRepetitionLevels(reader, daph, schemaPath) {
    if (schemaPath.length > 1) {
      const maxRepetitionLevel = getMaxRepetitionLevel(schemaPath);
      if (maxRepetitionLevel) {
        const values = new Array(daph.num_values);
        readRleBitPackedHybrid(reader, bitWidth(maxRepetitionLevel), 0, values);
        return values;
      }
    }
    return [];
  }
  function readDefinitionLevels(reader, daph, schemaPath) {
    const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
    if (!maxDefinitionLevel) return { definitionLevels: [], numNulls: 0 };
    const definitionLevels = new Array(daph.num_values);
    readRleBitPackedHybrid(reader, bitWidth(maxDefinitionLevel), 0, definitionLevels);
    let numNulls = daph.num_values;
    for (const def of definitionLevels) {
      if (def === maxDefinitionLevel) numNulls--;
    }
    if (numNulls === 0) definitionLevels.length = 0;
    return { definitionLevels, numNulls };
  }
  function decompressPage(compressedBytes, uncompressed_page_size, codec, compressors) {
    let page;
    const customDecompressor = compressors?.[codec];
    if (codec === "UNCOMPRESSED") {
      page = compressedBytes;
    } else if (customDecompressor) {
      page = customDecompressor(compressedBytes, uncompressed_page_size);
    } else if (codec === "SNAPPY") {
      page = new Uint8Array(uncompressed_page_size);
      snappyUncompress(compressedBytes, page);
    } else {
      throw new Error(`parquet unsupported compression codec: ${codec}`);
    }
    if (page?.length !== uncompressed_page_size) {
      throw new Error(`parquet decompressed page length ${page?.length} does not match header ${uncompressed_page_size}`);
    }
    return page;
  }

  // hyparquet/src/delta.js
  function deltaBinaryUnpack(reader, count, output) {
    const int32 = output instanceof Int32Array;
    const blockSize = readVarInt(reader);
    const miniblockPerBlock = readVarInt(reader);
    readVarInt(reader);
    let value = readZigZagBigInt(reader);
    let outputIndex = 0;
    output[outputIndex++] = int32 ? Number(value) : value;
    const valuesPerMiniblock = blockSize / miniblockPerBlock;
    while (outputIndex < count) {
      const minDelta = readZigZagBigInt(reader);
      const bitWidths = new Uint8Array(miniblockPerBlock);
      for (let i = 0; i < miniblockPerBlock; i++) {
        bitWidths[i] = reader.view.getUint8(reader.offset++);
      }
      for (let i = 0; i < miniblockPerBlock && outputIndex < count; i++) {
        const bitWidth2 = BigInt(bitWidths[i]);
        if (bitWidth2) {
          let bitpackPos = 0n;
          let miniblockCount = valuesPerMiniblock;
          const mask = (1n << bitWidth2) - 1n;
          while (miniblockCount && outputIndex < count) {
            let bits = BigInt(reader.view.getUint8(reader.offset)) >> bitpackPos & mask;
            bitpackPos += bitWidth2;
            while (bitpackPos >= 8) {
              bitpackPos -= 8n;
              reader.offset++;
              if (bitpackPos) {
                bits |= BigInt(reader.view.getUint8(reader.offset)) << bitWidth2 - bitpackPos & mask;
              }
            }
            const delta = minDelta + bits;
            value += delta;
            output[outputIndex++] = int32 ? Number(value) : value;
            miniblockCount--;
          }
          if (miniblockCount) {
            reader.offset += Math.ceil((miniblockCount * Number(bitWidth2) + Number(bitpackPos)) / 8);
          }
        } else {
          for (let j = 0; j < valuesPerMiniblock && outputIndex < count; j++) {
            value += minDelta;
            output[outputIndex++] = int32 ? Number(value) : value;
          }
        }
      }
    }
  }
  function deltaLengthByteArray(reader, count, output) {
    const lengths = new Int32Array(count);
    deltaBinaryUnpack(reader, count, lengths);
    for (let i = 0; i < count; i++) {
      output[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, lengths[i]);
      reader.offset += lengths[i];
    }
  }
  function deltaByteArray(reader, count, output) {
    const prefixData = new Int32Array(count);
    deltaBinaryUnpack(reader, count, prefixData);
    const suffixData = new Int32Array(count);
    deltaBinaryUnpack(reader, count, suffixData);
    for (let i = 0; i < count; i++) {
      const suffix = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, suffixData[i]);
      if (prefixData[i]) {
        output[i] = new Uint8Array(prefixData[i] + suffixData[i]);
        output[i].set(output[i - 1].subarray(0, prefixData[i]));
        output[i].set(suffix, prefixData[i]);
      } else {
        output[i] = suffix;
      }
      reader.offset += suffixData[i];
    }
  }

  // hyparquet/src/datapageV2.js
  function readDataPageV2(compressedBytes, ph, schemaPath, columnMetadata, compressors) {
    const view = new DataView(compressedBytes.buffer, compressedBytes.byteOffset, compressedBytes.byteLength);
    const reader = { view, offset: 0 };
    const { codec, type } = columnMetadata;
    const daph2 = ph.data_page_header_v2;
    if (!daph2) throw new Error("parquet data page header v2 is undefined");
    const repetitionLevels = readRepetitionLevelsV2(reader, daph2, schemaPath);
    reader.offset = daph2.repetition_levels_byte_length;
    const definitionLevels = readDefinitionLevelsV2(reader, daph2, schemaPath);
    const uncompressedPageSize = ph.uncompressed_page_size - daph2.definition_levels_byte_length - daph2.repetition_levels_byte_length;
    let page = compressedBytes.subarray(reader.offset);
    if (daph2.is_compressed !== false) {
      page = decompressPage(page, uncompressedPageSize, codec, compressors);
    }
    const pageView = new DataView(page.buffer, page.byteOffset, page.byteLength);
    const pageReader = { view: pageView, offset: 0 };
    let dataPage;
    const nValues = daph2.num_values - daph2.num_nulls;
    if (daph2.encoding === "PLAIN") {
      const { type_length } = schemaPath[schemaPath.length - 1].element;
      dataPage = readPlain(pageReader, type, nValues, type_length);
    } else if (daph2.encoding === "RLE") {
      dataPage = new Array(nValues);
      readRleBitPackedHybrid(pageReader, 1, 0, dataPage);
      dataPage = dataPage.map((x) => !!x);
    } else if (daph2.encoding === "PLAIN_DICTIONARY" || daph2.encoding === "RLE_DICTIONARY") {
      const bitWidth2 = pageView.getUint8(pageReader.offset++);
      dataPage = new Array(nValues);
      readRleBitPackedHybrid(pageReader, bitWidth2, uncompressedPageSize - 1, dataPage);
    } else if (daph2.encoding === "DELTA_BINARY_PACKED") {
      const int32 = type === "INT32";
      dataPage = int32 ? new Int32Array(nValues) : new BigInt64Array(nValues);
      deltaBinaryUnpack(pageReader, nValues, dataPage);
    } else if (daph2.encoding === "DELTA_LENGTH_BYTE_ARRAY") {
      dataPage = new Array(nValues);
      deltaLengthByteArray(pageReader, nValues, dataPage);
    } else if (daph2.encoding === "DELTA_BYTE_ARRAY") {
      dataPage = new Array(nValues);
      deltaByteArray(pageReader, nValues, dataPage);
    } else if (daph2.encoding === "BYTE_STREAM_SPLIT") {
      const { type_length } = schemaPath[schemaPath.length - 1].element;
      dataPage = byteStreamSplit(reader, nValues, type, type_length);
    } else {
      throw new Error(`parquet unsupported encoding: ${daph2.encoding}`);
    }
    return { definitionLevels, repetitionLevels, dataPage };
  }
  function readRepetitionLevelsV2(reader, daph2, schemaPath) {
    const maxRepetitionLevel = getMaxRepetitionLevel(schemaPath);
    if (!maxRepetitionLevel) return [];
    const values = new Array(daph2.num_values);
    readRleBitPackedHybrid(
      reader,
      bitWidth(maxRepetitionLevel),
      daph2.repetition_levels_byte_length,
      values
    );
    return values;
  }
  function readDefinitionLevelsV2(reader, daph2, schemaPath) {
    const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
    if (maxDefinitionLevel) {
      const values = new Array(daph2.num_values);
      readRleBitPackedHybrid(reader, bitWidth(maxDefinitionLevel), daph2.definition_levels_byte_length, values);
      return values;
    }
  }

  // hyparquet/src/header.js
  function parquetHeader(reader) {
    const header = deserializeTCompactProtocol(reader);
    const type = PageType[header.field_1];
    const uncompressed_page_size = header.field_2;
    const compressed_page_size = header.field_3;
    const crc = header.field_4;
    const data_page_header = header.field_5 && {
      num_values: header.field_5.field_1,
      encoding: Encoding[header.field_5.field_2],
      definition_level_encoding: Encoding[header.field_5.field_3],
      repetition_level_encoding: Encoding[header.field_5.field_4],
      statistics: header.field_5.field_5 && {
        max: header.field_5.field_5.field_1,
        min: header.field_5.field_5.field_2,
        null_count: header.field_5.field_5.field_3,
        distinct_count: header.field_5.field_5.field_4,
        max_value: header.field_5.field_5.field_5,
        min_value: header.field_5.field_5.field_6
      }
    };
    const index_page_header = header.field_6;
    const dictionary_page_header = header.field_7 && {
      num_values: header.field_7.field_1,
      encoding: Encoding[header.field_7.field_2],
      is_sorted: header.field_7.field_3
    };
    const data_page_header_v2 = header.field_8 && {
      num_values: header.field_8.field_1,
      num_nulls: header.field_8.field_2,
      num_rows: header.field_8.field_3,
      encoding: Encoding[header.field_8.field_4],
      definition_levels_byte_length: header.field_8.field_5,
      repetition_levels_byte_length: header.field_8.field_6,
      is_compressed: header.field_8.field_7 === void 0 ? true : header.field_8.field_7,
      // default true
      statistics: header.field_8.field_8
    };
    return {
      type,
      uncompressed_page_size,
      compressed_page_size,
      crc,
      data_page_header,
      index_page_header,
      dictionary_page_header,
      data_page_header_v2
    };
  }

  // hyparquet/src/utils.js
  function toJson(obj) {
    if (obj === void 0) return null;
    if (typeof obj === "bigint") return Number(obj);
    if (Array.isArray(obj)) return obj.map(toJson);
    if (obj instanceof Uint8Array) return Array.from(obj);
    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof Object) {
      const newObj = {};
      for (const key of Object.keys(obj)) {
        if (obj[key] === void 0) continue;
        newObj[key] = toJson(obj[key]);
      }
      return newObj;
    }
    return obj;
  }
  function concat(aaa, bbb) {
    const chunk = 1e4;
    for (let i = 0; i < bbb.length; i += chunk) {
      aaa.push(...bbb.slice(i, i + chunk));
    }
  }
  async function byteLengthFromUrl(url) {
    return await fetch(url, { method: "HEAD" }).then((res) => {
      if (!res.ok) throw new Error(`fetch head failed ${res.status}`);
      const length = res.headers.get("Content-Length");
      if (!length) throw new Error("missing content length");
      return parseInt(length);
    });
  }
  async function asyncBufferFromUrl(url, byteLength) {
    byteLength ||= await byteLengthFromUrl(url);
    return {
      byteLength,
      async slice(start, end) {
        const headers = new Headers();
        const endStr = end === void 0 ? "" : end - 1;
        headers.set("Range", `bytes=${start}-${endStr}`);
        const res = await fetch(url, { headers });
        if (!res.ok || !res.body) throw new Error(`fetch failed ${res.status}`);
        return res.arrayBuffer();
      }
    };
  }
  async function asyncBufferFromFile(filename) {
    const fsPackage = "fs";
    const fs = await import(fsPackage);
    const stat = await fs.promises.stat(filename);
    return {
      byteLength: stat.size,
      async slice(start, end) {
        const readStream = fs.createReadStream(filename, { start, end });
        return await readStreamToArrayBuffer(readStream);
      }
    };
  }
  function readStreamToArrayBuffer(input) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      input.on("data", (chunk) => chunks.push(chunk));
      input.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      });
      input.on("error", reject);
    });
  }

  // hyparquet/src/column.js
  function readColumn(reader, rowLimit, columnMetadata, schemaPath, { compressors, utf8 }) {
    const { element } = schemaPath[schemaPath.length - 1];
    let dictionary = void 0;
    const rowData = [];
    while (rowData.length < rowLimit) {
      const header = parquetHeader(reader);
      const compressedBytes = new Uint8Array(
        reader.view.buffer,
        reader.view.byteOffset + reader.offset,
        header.compressed_page_size
      );
      let values;
      if (header.type === "DATA_PAGE") {
        const daph = header.data_page_header;
        if (!daph) throw new Error("parquet data page header is undefined");
        const page = decompressPage(compressedBytes, Number(header.uncompressed_page_size), columnMetadata.codec, compressors);
        const { definitionLevels, repetitionLevels, dataPage } = readDataPage(page, daph, schemaPath, columnMetadata);
        values = convertWithDictionary(dataPage, dictionary, element, daph.encoding, utf8);
        if (repetitionLevels.length || definitionLevels?.length) {
          const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
          const repetitionPath = schemaPath.map(({ element: element2 }) => element2.repetition_type);
          assembleLists(
            rowData,
            definitionLevels,
            repetitionLevels,
            values,
            repetitionPath,
            maxDefinitionLevel
          );
        } else {
          for (let i = 2; i < schemaPath.length; i++) {
            if (schemaPath[i].element.repetition_type !== "REQUIRED") {
              values = Array.from(values, (e) => [e]);
            }
          }
          concat(rowData, values);
        }
      } else if (header.type === "DATA_PAGE_V2") {
        const daph2 = header.data_page_header_v2;
        if (!daph2) throw new Error("parquet data page header v2 is undefined");
        const { definitionLevels, repetitionLevels, dataPage } = readDataPageV2(
          compressedBytes,
          header,
          schemaPath,
          columnMetadata,
          compressors
        );
        values = convertWithDictionary(dataPage, dictionary, element, daph2.encoding, utf8);
        if (repetitionLevels.length || definitionLevels?.length) {
          const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
          const repetitionPath = schemaPath.map(({ element: element2 }) => element2.repetition_type);
          assembleLists(
            rowData,
            definitionLevels,
            repetitionLevels,
            values,
            repetitionPath,
            maxDefinitionLevel
          );
        } else {
          concat(rowData, values);
        }
      } else if (header.type === "DICTIONARY_PAGE") {
        const diph = header.dictionary_page_header;
        if (!diph) throw new Error("parquet dictionary page header is undefined");
        const page = decompressPage(
          compressedBytes,
          Number(header.uncompressed_page_size),
          columnMetadata.codec,
          compressors
        );
        dictionary = readDictionaryPage(page, diph, columnMetadata, element.type_length);
      } else {
        throw new Error(`parquet unsupported page type: ${header.type}`);
      }
      reader.offset += header.compressed_page_size;
    }
    if (rowData.length < rowLimit) {
      throw new Error(`parquet row data length ${rowData.length} does not match row group limit ${rowLimit}}`);
    }
    if (rowData.length > rowLimit) {
      rowData.length = rowLimit;
    }
    return rowData;
  }
  function getColumnRange({ dictionary_page_offset, data_page_offset, total_compressed_size }) {
    let columnOffset = dictionary_page_offset;
    if (!columnOffset || data_page_offset < columnOffset) {
      columnOffset = data_page_offset;
    }
    return [columnOffset, columnOffset + total_compressed_size];
  }

  // hyparquet/src/read.js
  async function parquetRead(options) {
    if (!options.file) throw new Error("parquet file is required");
    options.metadata ||= await parquetMetadataAsync(options.file);
    if (!options.metadata) throw new Error("parquet metadata not found");
    const { metadata, onComplete, rowEnd } = options;
    const rowStart = options.rowStart || 0;
    const rowData = [];
    let groupStart = 0;
    for (const rowGroup of metadata.row_groups) {
      const groupRows = Number(rowGroup.num_rows);
      if (groupStart + groupRows >= rowStart && (rowEnd === void 0 || groupStart < rowEnd)) {
        const rowLimit = rowEnd && rowEnd - groupStart;
        const groupData = await readRowGroup(options, rowGroup, groupStart, rowLimit);
        if (onComplete) {
          const start = Math.max(rowStart - groupStart, 0);
          const end = rowEnd === void 0 ? void 0 : rowEnd - groupStart;
          concat(rowData, groupData.slice(start, end));
        }
      }
      groupStart += groupRows;
    }
    if (onComplete) onComplete(rowData);
  }
  async function readRowGroup(options, rowGroup, groupStart, rowLimit) {
    const { file, metadata, columns } = options;
    if (!metadata) throw new Error("parquet metadata not found");
    if (rowLimit === void 0 || rowLimit > rowGroup.num_rows) rowLimit = Number(rowGroup.num_rows);
    let [groupStartByte, groupEndByte] = [file.byteLength, 0];
    rowGroup.columns.forEach(({ meta_data: columnMetadata }) => {
      if (!columnMetadata) throw new Error("parquet column metadata is undefined");
      if (columns && !columns.includes(columnMetadata.path_in_schema[0])) return;
      const [columnStartByte, columnEndByte] = getColumnRange(columnMetadata).map(Number);
      groupStartByte = Math.min(groupStartByte, columnStartByte);
      groupEndByte = Math.max(groupEndByte, columnEndByte);
    });
    if (groupStartByte >= groupEndByte && columns?.length) {
      throw new Error(`parquet columns not found: ${columns.join(", ")}`);
    }
    let groupBuffer;
    if (groupEndByte - groupStartByte <= 1 << 25) {
      groupBuffer = await file.slice(groupStartByte, groupEndByte);
    }
    const promises = [];
    const { children } = getSchemaPath(metadata.schema, [])[0];
    const subcolumnNames = new Map(children.map((child) => [child.element.name, getSubcolumns(child)]));
    const subcolumnData = /* @__PURE__ */ new Map();
    for (let columnIndex = 0; columnIndex < rowGroup.columns.length; columnIndex++) {
      const columnMetadata = rowGroup.columns[columnIndex].meta_data;
      if (!columnMetadata) throw new Error("parquet column metadata is undefined");
      const columnName = columnMetadata.path_in_schema[0];
      if (columns && !columns.includes(columnName)) continue;
      const [columnStartByte, columnEndByte] = getColumnRange(columnMetadata).map(Number);
      const columnBytes = columnEndByte - columnStartByte;
      if (columnBytes > 1 << 30) {
        console.warn(`parquet skipping huge column "${columnMetadata.path_in_schema}" ${columnBytes.toLocaleString()} bytes`);
        continue;
      }
      let buffer;
      let bufferOffset = 0;
      if (groupBuffer) {
        buffer = Promise.resolve(groupBuffer);
        bufferOffset = columnStartByte - groupStartByte;
      } else {
        buffer = Promise.resolve(file.slice(columnStartByte, columnEndByte));
      }
      promises.push(buffer.then((arrayBuffer) => {
        const schemaPath = getSchemaPath(metadata.schema, columnMetadata.path_in_schema);
        const reader = { view: new DataView(arrayBuffer), offset: bufferOffset };
        let columnData = readColumn(reader, rowLimit, columnMetadata, schemaPath, options);
        const subcolumn = columnMetadata.path_in_schema.join(".");
        subcolumnData.set(subcolumn, columnData);
        columnData = void 0;
        const subcolumns = subcolumnNames.get(columnName);
        if (subcolumns?.every((name) => subcolumnData.has(name))) {
          assembleNested(subcolumnData, schemaPath[1]);
          columnData = subcolumnData.get(columnName);
          if (!columnData) {
            throw new Error(`parquet column data not assembled: ${columnName}`);
          }
        }
        if (!columnData) return;
        options.onChunk?.({
          columnName,
          columnData,
          rowStart: groupStart,
          rowEnd: groupStart + columnData.length
        });
      }));
    }
    await Promise.all(promises);
    if (options.onComplete) {
      const groupData = new Array(rowLimit);
      const includedColumnNames = children.map((child) => child.element.name).filter((name) => !columns || columns.includes(name));
      const columnOrder = columns || includedColumnNames;
      const includedColumns = columnOrder.map((name) => includedColumnNames.includes(name) ? subcolumnData.get(name) : void 0);
      for (let row = 0; row < rowLimit; row++) {
        if (options.rowFormat === "object") {
          const rowData = {};
          columnOrder.forEach((name, index) => {
            rowData[name] = includedColumns[index]?.[row];
          });
          groupData[row] = rowData;
        } else {
          groupData[row] = includedColumns.map((column) => column?.[row]);
        }
      }
      return groupData;
    }
    return [];
  }
  function getSubcolumns(schema, output = []) {
    if (schema.children.length) {
      for (const child of schema.children) {
        getSubcolumns(child, output);
      }
    } else {
      output.push(schema.path.join("."));
    }
    return output;
  }

  // hyparquet/src/query.js
  async function parquetQuery(options) {
    const { file, rowStart, rowEnd, orderBy } = options;
    options.metadata ||= await parquetMetadataAsync(file);
    if (typeof orderBy === "string") {
      const orderColumn = await parquetReadObjects({ ...options, rowStart: void 0, rowEnd: void 0, columns: [orderBy] });
      const sortedIndices = Array.from(orderColumn, (_, index) => index).sort((a, b) => compare(orderColumn[a][orderBy], orderColumn[b][orderBy])).slice(rowStart, rowEnd);
      const sparseData = await parquetReadRows({ ...options, rows: sortedIndices });
      const data = sortedIndices.map((index) => sparseData[index]);
      return data;
    } else {
      return await parquetReadObjects(options);
    }
  }
  async function parquetReadRows(options) {
    const { file, rows } = options;
    options.metadata ||= await parquetMetadataAsync(file);
    const { row_groups: rowGroups } = options.metadata;
    const groupIncluded = Array(rowGroups.length).fill(false);
    let groupStart = 0;
    const groupEnds = rowGroups.map((group) => groupStart += Number(group.num_rows));
    for (const index of rows) {
      const groupIndex = groupEnds.findIndex((end) => index < end);
      groupIncluded[groupIndex] = true;
    }
    const rowRanges = [];
    let rangeStart;
    groupStart = 0;
    for (let i = 0; i < groupIncluded.length; i++) {
      const groupEnd = groupStart + Number(rowGroups[i].num_rows);
      if (groupIncluded[i]) {
        if (rangeStart === void 0) {
          rangeStart = groupStart;
        }
      } else {
        if (rangeStart !== void 0) {
          rowRanges.push([rangeStart, groupEnd]);
          rangeStart = void 0;
        }
      }
      groupStart = groupEnd;
    }
    if (rangeStart !== void 0) {
      rowRanges.push([rangeStart, groupStart]);
    }
    const sparseData = new Array(Number(options.metadata.num_rows));
    for (const [rangeStart2, rangeEnd] of rowRanges) {
      const groupData = await parquetReadObjects({ ...options, rowStart: rangeStart2, rowEnd: rangeEnd });
      for (let i = rangeStart2; i < rangeEnd; i++) {
        sparseData[i] = groupData[i - rangeStart2];
        sparseData[i].__index__ = i;
      }
    }
    return sparseData;
  }
  function compare(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 1;
  }

  // hyparquet/src/hyparquet.js
  function parquetReadObjects(options) {
    return new Promise((onComplete, reject) => {
      parquetRead({
        rowFormat: "object",
        ...options,
        onComplete
      }).catch(reject);
    });
  }
  return __toCommonJS(hyparquet_exports);
})();
