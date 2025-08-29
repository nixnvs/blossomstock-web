import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const recuentos = await sql(`
      SELECT 
        id, 
        mes, 
        estado, 
        fecha_creacion, 
        fecha_cierre
      FROM recuentos 
      ORDER BY mes DESC
    `);

    return Response.json(recuentos);
  } catch (error) {
    console.error("Error fetching recuentos:", error);
    return Response.json(
      { error: "Error al obtener los recuentos" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { mes } = body;

    if (!mes) {
      return Response.json(
        { error: "El mes es requerido (formato YYYY-MM)" },
        { status: 400 },
      );
    }

    // Verificar que no exista ya un recuento para este mes
    const existingRecuento = await sql(
      `SELECT id FROM recuentos WHERE mes = $1`,
      [mes],
    );

    if (existingRecuento.length > 0) {
      return Response.json(
        { error: "Ya existe un recuento para este mes" },
        { status: 400 },
      );
    }

    // Crear el recuento
    const [recuento] = await sql(
      `
      INSERT INTO recuentos (mes, estado)
      VALUES ($1, 'Borrador')
      RETURNING id, mes, estado, fecha_creacion, fecha_cierre
    `,
      [mes],
    );

    // Obtener todos los artículos activos
    const itemsActivos = await sql(`
      SELECT id, articulo, categoria, precio_unidad, cantidad_objetivo
      FROM items 
      WHERE activo = true
      ORDER BY categoria ASC, articulo ASC
    `);

    // Obtener los reportes de empleados para este mes (solo el más reciente por artículo)
    const reportesEmpleados = await sql(
      `
      WITH latest_reports AS (
        SELECT 
          articulo_id,
          cantidad,
          notas,
          ROW_NUMBER() OVER (PARTITION BY articulo_id ORDER BY created_at DESC) as rn
        FROM reports 
        WHERE mes = $1
      )
      SELECT 
        articulo_id,
        cantidad as total_reportado,
        notas as notas_empleados
      FROM latest_reports 
      WHERE rn = 1
    `,
      [mes],
    );

    // Crear un mapa de reportes por artículo
    const reportesPorArticulo = {};
    reportesEmpleados.forEach((reporte) => {
      reportesPorArticulo[reporte.articulo_id] = {
        cantidad: parseInt(reporte.total_reportado),
        notas: reporte.notas_empleados,
      };
    });

    // Crear líneas de recuento para cada artículo activo
    if (itemsActivos.length > 0) {
      const lineasValues = itemsActivos.map((item) => {
        // El empleado reporta la cantidad que ENCONTRÓ en stock (no la que falta)
        // Si no hay reportes, asumimos que no se ha contado aún (0 encontrado)
        const reporteData = reportesPorArticulo[item.id];
        const cantidadEncontrada = reporteData?.cantidad || 0;

        // La cantidad actual es lo que el empleado encontró, limitado por la cantidad objetivo
        const cantidadActual = Math.min(
          cantidadEncontrada,
          item.cantidad_objetivo,
        );
        const notasEmpleados = reporteData?.notas || null;

        return [
          recuento.id,
          item.id,
          item.articulo,
          item.categoria,
          item.precio_unidad,
          item.cantidad_objetivo,
          cantidadActual, // cantidad_actual basada en reportes de empleados
          notasEmpleados, // notas de empleados
        ];
      });

      // Construir la query de inserción múltiple
      const placeholders = lineasValues
        .map(
          (_, index) =>
            `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${
              index * 8 + 4
            }, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`,
        )
        .join(", ");

      const insertQuery = `
        INSERT INTO recuento_lineas 
        (recuento_id, item_id, articulo_nombre, categoria, precio_unidad, cantidad_objetivo, cantidad_actual, nota_linea)
        VALUES ${placeholders}
      `;

      const flatValues = lineasValues.flat();
      await sql(insertQuery, flatValues);
    }

    // Contar cuántas líneas se crearon
    const lineas_count = itemsActivos.length;

    return Response.json({ ...recuento, lineas_count }, { status: 201 });
  } catch (error) {
    console.error("Error creating recuento:", error);
    return Response.json(
      { error: "Error al crear el recuento" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, estado } = body;

    if (!id) {
      return Response.json(
        { error: "ID del recuento es requerido" },
        { status: 400 },
      );
    }

    if (!estado || !["Borrador", "Cerrado"].includes(estado)) {
      return Response.json(
        { error: "Estado debe ser 'Borrador' o 'Cerrado'" },
        { status: 400 },
      );
    }

    // Verificar que el recuento existe
    const existingRecuento = await sql(
      `SELECT id, estado FROM recuentos WHERE id = $1`,
      [id],
    );

    if (existingRecuento.length === 0) {
      return Response.json(
        { error: "Recuento no encontrado" },
        { status: 404 },
      );
    }

    // No permitir cambiar estado de Cerrado a Borrador
    if (existingRecuento[0].estado === "Cerrado" && estado === "Borrador") {
      return Response.json(
        { error: "No se puede reabrir un recuento cerrado" },
        { status: 400 },
      );
    }

    const updateFields = ["estado = $2"];
    const values = [id, estado];

    // Si se está cerrando, agregar fecha de cierre
    if (estado === "Cerrado") {
      updateFields.push("fecha_cierre = CURRENT_TIMESTAMP");
    }

    const [updatedRecuento] = await sql(
      `
      UPDATE recuentos 
      SET ${updateFields.join(", ")}
      WHERE id = $1
      RETURNING id, mes, estado, fecha_creacion, fecha_cierre
    `,
      values,
    );

    return Response.json(updatedRecuento);
  } catch (error) {
    console.error("Error updating recuento:", error);
    return Response.json(
      { error: "Error al actualizar el recuento" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "ID del recuento es requerido" },
        { status: 400 },
      );
    }

    // Verificar que el recuento existe
    const existingRecuento = await sql(
      `SELECT id, estado FROM recuentos WHERE id = $1`,
      [id],
    );

    if (existingRecuento.length === 0) {
      return Response.json(
        { error: "Recuento no encontrado" },
        { status: 404 },
      );
    }

    // Eliminar el recuento (las líneas se eliminan automáticamente por CASCADE)
    await sql(`DELETE FROM recuentos WHERE id = $1`, [id]);

    return Response.json({ message: "Recuento eliminado correctamente" });
  } catch (error) {
    console.error("Error deleting recuento:", error);
    return Response.json(
      { error: "Error al eliminar el recuento" },
      { status: 500 },
    );
  }
}
