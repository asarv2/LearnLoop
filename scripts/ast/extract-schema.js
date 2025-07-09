// scripts/ast/extract-schema.js
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const { Project } = require("ts-morph");

/**
 * Converts AST schema format to the format expected by the rest of the script
 */
function extractSchema(dbTypesPath = path.resolve(__dirname, "../../database.types.ts")) {
  const project = new Project({
    tsConfigFilePath: path.resolve(__dirname, "../../tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  const source = project.addSourceFileAtPath(dbTypesPath);

  // ----- 1. Grab Database type -----
  const databaseAlias = source.getTypeAliasOrThrow("Database");
  const databaseType = databaseAlias.getType();

  const publicType = getPropType(databaseType, "public");
  const tablesType = getPropType(publicType, "Tables");

  // ----- 2. Iterate tables -----
  const tables = {};
  for (const prop of tablesType.getProperties()) {
    const tableName = prop.getName();
    const tableType = prop.getTypeAtLocation(prop.getDeclarations()[0]);

    const rowType = getPropType(tableType, "Row");

    const columns = rowType
      .getProperties()
      .map((sym) => {
        const colType = sym.getTypeAtLocation(sym.getDeclarations()[0]);
        return {
          name: sym.getName(),
          type: colType.getText(),
          isNullable: colType.isNullable(),
        };
      });

    const pkCol = columns.find((c) => c.name === "id") ?? columns[0];
    const pkType =
      pkCol.type.includes("number") || pkCol.type.includes("integer")
        ? "number"
        : "string";

    tables[tableName] = {
      pk: pkCol.name,
      pkType,
      columns,
      relationships: parseRelationships(tableType),
    };
  }

  // ----- 3. Enums -----
  const enums = {};
  const enumsType = getPropType(publicType, "Enums");
  for (const e of enumsType.getProperties()) {
    const literalValues = e
      .getTypeAtLocation(e.getDeclarations()[0])
      .getUnionTypes()
      .map((t) => t.getLiteralValue());
    enums[e.getName()] = literalValues;
  }

  return { public: { tables }, enums };

  // ===== helpers =====
  function getPropType(parent, key) {
    return parent.getPropertyOrThrow(key).getTypeAtLocation(
      parent.getSymbol().getDeclarations()[0]
    );
  }

  function parseRelationships(tableType) {
    const relProp = tableType.getProperty("Relationships");
    if (!relProp) return [];

    const tuple = relProp.getTypeAtLocation(relProp.getDeclarations()[0]);
    return tuple
      .getTupleElements()
      .map((el) => {
        const fkName = el.getProperty("foreignKeyName");
        if (!fkName) return null; // not an FK row

        return {
          column: literalOf(el, "columns"),
          references: literalOf(el, "referencedRelation"),
          referencesColumn: literalOf(el, "referencedColumns"),
        };
      })
      .filter(Boolean);

    function literalOf(type, key) {
      const prop = type.getPropertyOrThrow(key);
      const t = prop.getTypeAtLocation(prop.getDeclarations()[0]);
      if (t.isStringLiteral()) return t.getLiteralValue();
      // Handle array types - get first element if it's an array
      if (t.isArray()) {
        const elementType = t.getArrayElementType();
        if (elementType && elementType.isStringLiteral()) {
          return elementType.getLiteralValue();
        }
      }
      return "";
    }
  }
}

module.exports = { extractSchema }; 