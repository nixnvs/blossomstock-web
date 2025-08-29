import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activo = searchParams.get("activo");
    const id = searchParams.get("id");

    let query = `
      SELECT id, articulo, categoria, foto, precio_unidad, cantidad_objetivo, unidad, proveedor, proveedor_url, activo, created_at
      FROM items 
    `;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (id) {
      whereConditions.push(`id = $${paramIndex}`);
      params.push(parseInt(id));
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`categoria = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (activo !== null && activo !== undefined) {
      whereConditions.push(`activo = $${paramIndex}`);
      params.push(activo === "true");
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    query += ` ORDER BY categoria ASC, articulo ASC`;

    const items = await sql(query, params);

    return Response.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    return Response.json(
      { error: "Error al obtener los artículos" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      articulo,
      categoria,
      foto,
      precio_unidad,
      cantidad_objetivo,
      unidad,
      proveedor,
      proveedor_url,
      activo = true,
    } = body;

    // Validaciones obligatorias
    if (
      !articulo ||
      !categoria ||
      precio_unidad === undefined ||
      cantidad_objetivo === undefined
    ) {
      return Response.json(
        {
          error:
            "Faltan campos requeridos: articulo, categoria, precio_unidad, cantidad_objetivo",
        },
        { status: 400 },
      );
    }

    // Verificar que la categoría es válida
    const validCategories = [
      "Platos",
      "Copas",
      "Bowls",
      "Cubiertos",
      "Barware",
      "Cocina",
      "Servicio",
      "Otros",
    ];
    if (!validCategories.includes(categoria)) {
      return Response.json({ error: "Categoría no válida" }, { status: 400 });
    }

    // Verificar que el precio es válido
    if (isNaN(parseFloat(precio_unidad)) || parseFloat(precio_unidad) < 0) {
      return Response.json(
        { error: "El precio debe ser un número mayor o igual a 0" },
        { status: 400 },
      );
    }

    // Verificar que cantidad_objetivo es válido
    if (isNaN(parseInt(cantidad_objetivo)) || parseInt(cantidad_objetivo) < 0) {
      return Response.json(
        { error: "La cantidad objetivo debe ser un número mayor o igual a 0" },
        { status: 400 },
      );
    }

    const result = await sql(
      `
      INSERT INTO items (articulo, categoria, foto, precio_unidad, cantidad_objetivo, unidad, proveedor, proveedor_url, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, articulo, categoria, foto, precio_unidad, cantidad_objetivo, unidad, proveedor, proveedor_url, activo, created_at
    `,
      [
        articulo,
        categoria,
        foto,
        parseFloat(precio_unidad),
        parseInt(cantidad_objetivo),
        unidad,
        proveedor,
        proveedor_url,
        activo,
      ],
    );

    return Response.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error creating item:", error);
    return Response.json(
      { error: "Error al crear el artículo" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      articulo,
      categoria,
      foto,
      precio_unidad,
      cantidad_objetivo,
      unidad,
      proveedor,
      proveedor_url,
      activo,
    } = body;

    // Validar que el ID existe
    if (!id) {
      return Response.json(
        { error: "ID del artículo es requerido" },
        { status: 400 },
      );
    }

    // Verificar que el artículo existe
    const existingItem = await sql(`SELECT id FROM items WHERE id = $1`, [id]);
    if (existingItem.length === 0) {
      return Response.json(
        { error: "Artículo no encontrado" },
        { status: 404 },
      );
    }

    // Construir query dinámico solo con campos proporcionados
    let setClause = [];
    let values = [];
    let paramIndex = 1;

    if (articulo !== undefined) {
      setClause.push(`articulo = $${paramIndex}`);
      values.push(articulo);
      paramIndex++;
    }

    if (categoria !== undefined) {
      const validCategories = [
        "Platos",
        "Copas",
        "Bowls",
        "Cubiertos",
        "Barware",
        "Cocina",
        "Servicio",
        "Otros",
      ];
      if (!validCategories.includes(categoria)) {
        return Response.json({ error: "Categoría no válida" }, { status: 400 });
      }
      setClause.push(`categoria = $${paramIndex}`);
      values.push(categoria);
      paramIndex++;
    }

    if (foto !== undefined) {
      setClause.push(`foto = $${paramIndex}`);
      values.push(foto);
      paramIndex++;
    }

    if (precio_unidad !== undefined) {
      if (isNaN(parseFloat(precio_unidad)) || parseFloat(precio_unidad) < 0) {
        return Response.json(
          { error: "El precio debe ser un número mayor o igual a 0" },
          { status: 400 },
        );
      }
      setClause.push(`precio_unidad = $${paramIndex}`);
      values.push(parseFloat(precio_unidad));
      paramIndex++;
    }

    if (cantidad_objetivo !== undefined) {
      if (
        isNaN(parseInt(cantidad_objetivo)) ||
        parseInt(cantidad_objetivo) < 0
      ) {
        return Response.json(
          {
            error: "La cantidad objetivo debe ser un número mayor o igual a 0",
          },
          { status: 400 },
        );
      }
      setClause.push(`cantidad_objetivo = $${paramIndex}`);
      values.push(parseInt(cantidad_objetivo));
      paramIndex++;
    }

    if (unidad !== undefined) {
      setClause.push(`unidad = $${paramIndex}`);
      values.push(unidad);
      paramIndex++;
    }

    if (proveedor !== undefined) {
      setClause.push(`proveedor = $${paramIndex}`);
      values.push(proveedor);
      paramIndex++;
    }

    if (proveedor_url !== undefined) {
      setClause.push(`proveedor_url = $${paramIndex}`);
      values.push(proveedor_url);
      paramIndex++;
    }

    if (activo !== undefined) {
      setClause.push(`activo = $${paramIndex}`);
      values.push(activo);
      paramIndex++;
    }

    if (setClause.length === 0) {
      return Response.json(
        { error: "No hay campos para actualizar" },
        { status: 400 },
      );
    }

    // Añadir ID al final de los parámetros
    values.push(id);

    const query = `
      UPDATE items 
      SET ${setClause.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, articulo, categoria, foto, precio_unidad, cantidad_objetivo, unidad, proveedor, proveedor_url, activo, created_at
    `;

    const result = await sql(query, values);

    return Response.json(result[0]);
  } catch (error) {
    console.error("Error updating item:", error);
    return Response.json(
      { error: "Error al actualizar el artículo" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "ID del artículo es requerido" },
        { status: 400 },
      );
    }

    // Obtener el nombre del artículo para la confirmación
    const existingItem = await sql(`SELECT articulo FROM items WHERE id = $1`, [
      id,
    ]);
    if (existingItem.length === 0) {
      return Response.json(
        { error: "Artículo no encontrado" },
        { status: 404 },
      );
    }

    // Usar transacción para eliminar el artículo y sus líneas asociadas
    await sql.transaction([
      sql`DELETE FROM recuento_lineas WHERE item_id = ${id}`,
      sql`DELETE FROM items WHERE id = ${id}`,
    ]);

    return Response.json({
      success: true,
      message: `Artículo "${existingItem[0].articulo}" eliminado correctamente junto con sus líneas de recuento asociadas`,
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    return Response.json(
      { error: "Error al eliminar el artículo" },
      { status: 500 },
    );
  }
}
