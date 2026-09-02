using System;
using System.IO;
using System.Text;

namespace Brantas.Analytics.Anomalies;

public static class OnnxModelBuilder
{
    public static byte[] BuildIdentityModel()
    {
        using var ms = new MemoryStream();
        // ModelProto:
        // ir_version = 8 (field 1, varint) -> 0x08, 0x08
        WriteVarint(ms, 1, 8);

        // opset_import (field 8, message OperatorSetIdProto) -> tag = (8 << 3) | 2 = 0x42
        var opsetBytes = BuildOpset();
        WriteMessage(ms, 8, opsetBytes);

        // producer_name (field 2, string) -> tag = (2 << 3) | 2 = 0x12
        WriteString(ms, 2, "BRANTAS_ONNX");

        // graph (field 7, message GraphProto) -> tag = (7 << 3) | 2 = 0x3a
        var graphBytes = BuildGraph();
        WriteMessage(ms, 7, graphBytes);

        return ms.ToArray();
    }

    private static byte[] BuildOpset()
    {
        using var ms = new MemoryStream();
        // domain = "" (field 1, string)
        // version = 13 (field 2, varint)
        WriteVarint(ms, 2, 13);
        return ms.ToArray();
    }

    private static byte[] BuildGraph()
    {
        using var ms = new MemoryStream();
        // node (field 1, NodeProto) -> tag = 0x0a
        var nodeBytes = BuildNode();
        WriteMessage(ms, 1, nodeBytes);

        // name (field 2, string) -> tag = 0x12
        WriteString(ms, 2, "anomaly_graph");

        // input (field 11, ValueInfoProto) -> tag = (11 << 3) | 2 = 0x5a
        var inputBytes = BuildValueInfo("input");
        WriteMessage(ms, 11, inputBytes);

        // output (field 12, ValueInfoProto) -> tag = (12 << 3) | 2 = 0x62
        var outputBytes = BuildValueInfo("output");
        WriteMessage(ms, 12, outputBytes);

        return ms.ToArray();
    }

    private static byte[] BuildNode()
    {
        using var ms = new MemoryStream();
        // input (field 1, string) = "input"
        WriteString(ms, 1, "input");
        // output (field 2, string) = "output"
        WriteString(ms, 2, "output");
        // name (field 3, string) = "identity_node"
        WriteString(ms, 3, "identity_node");
        // op_type (field 4, string) = "Identity"
        WriteString(ms, 4, "Identity");
        return ms.ToArray();
    }

    private static byte[] BuildValueInfo(string name)
    {
        using var ms = new MemoryStream();
        // name (field 1, string)
        WriteString(ms, 1, name);
        // type (field 2, TypeProto)
        var typeBytes = BuildTypeProto();
        WriteMessage(ms, 2, typeBytes);
        return ms.ToArray();
    }

    private static byte[] BuildTypeProto()
    {
        using var ms = new MemoryStream();
        // tensor_type (field 1, TypeProto.Tensor)
        var tensorTypeBytes = BuildTensorType();
        WriteMessage(ms, 1, tensorTypeBytes);
        return ms.ToArray();
    }

    private static byte[] BuildTensorType()
    {
        using var ms = new MemoryStream();
        // elem_type = 1 (FLOAT, field 1, varint)
        WriteVarint(ms, 1, 1);
        // shape (field 2, TensorShapeProto)
        var shapeBytes = BuildShapeProto();
        WriteMessage(ms, 2, shapeBytes);
        return ms.ToArray();
    }

    private static byte[] BuildShapeProto()
    {
        using var ms = new MemoryStream();
        // dim 1: dim_param = "N" (dim field 1, TensorShapeProto.Dimension)
        var dim1 = BuildDimension("N");
        WriteMessage(ms, 1, dim1);
        // dim 2: dim_value = 5 (dim_value field 1 in Dimension, varint)
        var dim2 = BuildDimensionValue(5);
        WriteMessage(ms, 1, dim2);
        return ms.ToArray();
    }

    private static byte[] BuildDimension(string param)
    {
        using var ms = new MemoryStream();
        // dim_param (field 2, string)
        WriteString(ms, 2, param);
        return ms.ToArray();
    }

    private static byte[] BuildDimensionValue(long val)
    {
        using var ms = new MemoryStream();
        // dim_value (field 1, varint)
        WriteVarint(ms, 1, val);
        return ms.ToArray();
    }

    private static void WriteVarint(Stream stream, int fieldNumber, long value)
    {
        WriteTag(stream, fieldNumber, 0);
        WriteRawVarint(stream, (ulong)value);
    }

    private static void WriteString(Stream stream, int fieldNumber, string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        WriteTag(stream, fieldNumber, 2);
        WriteRawVarint(stream, (ulong)bytes.Length);
        stream.Write(bytes, 0, bytes.Length);
    }

    private static void WriteMessage(Stream stream, int fieldNumber, byte[] messageBytes)
    {
        WriteTag(stream, fieldNumber, 2);
        WriteRawVarint(stream, (ulong)messageBytes.Length);
        stream.Write(messageBytes, 0, messageBytes.Length);
    }

    private static void WriteTag(Stream stream, int fieldNumber, int wireType)
    {
        WriteRawVarint(stream, (ulong)((fieldNumber << 3) | wireType));
    }

    private static void WriteRawVarint(Stream stream, ulong value)
    {
        while (value >= 0x80)
        {
            stream.WriteByte((byte)((value & 0x7F) | 0x80));
            value >>= 7;
        }
        stream.WriteByte((byte)value);
    }
}
