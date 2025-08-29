import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return Response.json(
        { error: "ID del recuento es requerido" },
        { status: 400 },
      );
    }

    // Verificar que el recuento existe
    const recuento = await sql(
      `SELECT id, estado FROM recuentos WHERE id = $1`,
      [id],
    );

    if (recuento.length === 0) {
      return Response.json(
        { error: "Recuento no encontrado" },
        { status: 404 },
      );
    }

    // Obtener las líneas del recuento
    const lineas = await sql(
      `
      SELECT 
        rl.id,
        rl.recuento_id,
        rl.item_id,
        rl.articulo_nombre,
        rl.categoria,
        rl.precio_unidad,
        rl.cantidad_objetivo,
        rl.cantidad_actual,
        rl.nota_linea,
        rl.created_at,
        rl.updated_at,
        i.foto
      FROM recuento_lineas rl
      LEFT JOIN items i ON rl.item_id = i.id
      WHERE rl.recuento_id = $1
      ORDER BY rl.categoria ASC, rl.articulo_nombre ASC
    `,
      [id],
    );

    return Response.json({
      recuento: recuento[0],
      lineas: lineas,
    });
  } catch (error) {
    console.error("Error fetching recuento lineas:", error);
    return Response.json(
      { error: "Error al obtener las líneas del recuento" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { linea_id, cantidad_actual, nota_linea } = body;

    if (!id || !linea_id) {
      return Response.json(
        { error: "ID del recuento y ID de línea son requeridos" },
        { status: 400 },
      );
    }

    // Verificar que el recuento existe y está en estado Borrador
    const recuento = await sql(
      `SELECT id, estado FROM recuentos WHERE id = $1`,
      [id],
    );

    if (recuento.length === 0) {
      return Response.json(
        { error: "Recuento no encontrado" },
        { status: 404 },
      );
    }

    if (recuento[0].estado === "Cerrado") {
      return Response.json(
        { error: "No se puede editar un recuento cerrado" },
        { status: 400 },
      );
    }

    // Validar cantidad_actual
    if (cantidad_actual !== undefined) {
      if (isNaN(parseInt(cantidad_actual)) || parseInt(cantidad_actual) < 0) {
        return Response.json(
          { error: "La cantidad actual debe ser un número mayor o igual a 0" },
          { status: 400 },
        );
      }
    }

    // Verificar que la línea existe y pertenece al recuento
    const linea = await sql(
      `SELECT id FROM recuento_lineas WHERE id = $1 AND recuento_id = $2`,
      [linea_id, id],
    );

    if (linea.length === 0) {
      return Response.json(
        { error: "Línea de recuento no encontrada" },
        { status: 404 },
      );
    }

    // Construir query de actualización dinámico
    let setClause = [];
    let values = [];
    let paramIndex = 1;

    if (cantidad_actual !== undefined) {
      setClause.push(`cantidad_actual = $${paramIndex}`);
      values.push(parseInt(cantidad_actual));
      paramIndex++;
    }

    if (nota_linea !== undefined) {
      setClause.push(`nota_linea = $${paramIndex}`);
      values.push(nota_linea);
      paramIndex++;
    }

    if (setClause.length === 0) {
      return Response.json(
        { error: "No hay campos para actualizar" },
        { status: 400 },
      );
    }

    // Agregar updated_at
    setClause.push(`updated_at = CURRENT_TIMESTAMP`);

    // Agregar linea_id al final
    values.push(linea_id);

    const query = `
      UPDATE recuento_lineas 
      SET ${setClause.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        recuento_id,
        item_id,
        articulo_nombre,
        categoria,
        precio_unidad,
        cantidad_objetivo,
        cantidad_actual,
        nota_linea,
        created_at,
        updated_at
    `;

    const [updatedLinea] = await sql(query, values);

    return Response.json(updatedLinea);
  } catch (error) {
    console.error("Error updating recuento linea:", error);
    return Response.json(
      { error: "Error al actualizar la línea del recuento" },
      { status: 500 },
    );
  }
}
