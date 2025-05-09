import React, { useState, useEffect } from "react";
import "../styles/modal.css";
import "../styles/modalReserva.css";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

const ModalReserva = ({
  servicio,
  opcionSeleccionada,
  servicioId,
  onClose,
  onReservaConfirmada,
}) => {
  const { user } = useAuth();
  const clienteId = user?.id_cliente;
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [profesional, setProfesional] = useState("");
  const [profesionalId, setProfesionalId] = useState(null);
  const [paso, setPaso] = useState(1);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [horariosCargados, setHorariosCargados] = useState(false);
  const [turnosOcupados, setTurnosOcupados] = useState([]);
  const [servicioIdState, setServicioIdState] = useState(servicioId);

  useEffect(() => {
    console.log("Servicio recibido:", servicio);
    if (servicioId) {
      console.log("Usando ID de servicio específico:", servicioId);
      setServicioIdState(servicioId);
    }
    else if (servicio && servicio.id_servicio) {
      console.log("Usando ID de servicio directo:", servicio.id_servicio);
      setServicioIdState(servicio.id_servicio);
    }
    else if (servicio && servicio.id) {
      console.log("Usando ID genérico:", servicio.id);
      setServicioIdState(servicio.id);
    }
    else if (servicio && servicio.title) {
      console.log("Buscando servicio por nombre:", servicio.title);
      fetchServicios();
    }
  }, [servicio, servicioId]);

  const fetchServicios = async () => {
    if (!servicio || !servicio.title) return;
    try {
      setLoading(true);
      console.log("Buscando servicio por nombre:", servicio.title);
      const response = await axios.get("http://localhost:3001/api/servicios");
      const serviciosData = response.data;
      console.log("Servicios obtenidos:", serviciosData);
      const servicioEncontrado = serviciosData.find(
        s =>
          s.nombre.toLowerCase() === servicio.title.toLowerCase() ||
          s.nombre.toLowerCase().includes(servicio.title.toLowerCase()) ||
          servicio.title.toLowerCase().includes(s.nombre.toLowerCase())
      );
      if (servicioEncontrado) {
        console.log("Servicio encontrado:", servicioEncontrado);
        setServicioIdState(servicioEncontrado.id_servicio);
      } else {
        console.error(
          "No se encontró el servicio con nombre:",
          servicio.title
        );
        setError("No se encontró el servicio seleccionado");
      }
    } catch (err) {
      console.error("Error al cargar servicios:", err);
      setError("No se pudieron cargar los servicios. Intenta de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchProfesionales = async () => {
      if (!servicioIdState) {
        console.error("No se tiene un ID de servicio válido para buscar profesionales");
        setError("No se pudo identificar el servicio seleccionado");
        return;
      }

      setLoading(true);
      try {
        console.log(`Llamando a la API con servicioId: ${servicioIdState}`);
        const response = await axios.get(
          `http://localhost:3001/api/profesionales/servicio/${servicioIdState}`
        );

        console.log("Datos de profesionales:", JSON.stringify(response.data));
        if (response.data && response.data.length > 0) {
          setProfesionales(response.data);
          setError(null);
        } else {
          setError("No hay profesionales disponibles para este servicio");
          setProfesionales([]);
        }
      } catch (err) {
        console.error("Error al cargar profesionales:", err);
        setError("No se pudieron cargar los profesionales");
      } finally {
        setLoading(false);
      }
    };

    if (servicioIdState) {
      fetchProfesionales();
    }
  }, [servicioIdState]);

  const verificarDisponibilidad = async (fecha, idProfesional = null) => {
    if (!servicioIdState) return;
    try {
      const fechaStr = fecha.toISOString().split("T")[0];
      const params = {
        fecha: fechaStr,
        id_servicio: servicioIdState
      };

      if (idProfesional) {
        params.id_profesional = idProfesional;
      }

      const response = await axios.get(
        "http://localhost:3001/api/turnos/disponibilidad",
        { params }
      );

      if (response.data && response.data.turnosOcupados) {
        setTurnosOcupados(response.data.turnosOcupados);
      }
      setHorariosCargados(true);
    } catch (err) {
      console.error("Error al verificar disponibilidad:", err);
      setHorariosCargados(true);
    }
  };

  const handleFechaHoraSeleccionada = (nuevaFecha, nuevaHora) => {
    if (nuevaFecha) {
      const fechaStr = nuevaFecha.toISOString().split("T")[0];
      setFecha(fechaStr);
      setDiaSeleccionado(nuevaFecha);
      verificarDisponibilidad(nuevaFecha, profesionalId);
    }
    if (nuevaHora) setHora(nuevaHora);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (paso === 1) {
      if (!fecha || !hora)
        return alert("Selecciona fecha y hora para continuar.");
      setPaso(2);
    } else {
      if (!profesionalId) return alert("Selecciona un profesional.");
      if (!clienteId) return alert("Debes iniciar sesión para reservar un turno.");
      if (!servicioIdState)
        return alert("No se ha podido identificar el servicio seleccionado.");

      const fechaHoraSQL = `${fecha} ${hora}:00`;
      const datosTurno = {
        id_cliente: Number(clienteId),
        id_servicio: Number(servicioIdState),
        id_profesional: Number(profesionalId),
        fecha_hora: fechaHoraSQL,
        duracion_minutos: Number(opcionSeleccionada?.duracion || 60),
        comentarios: `Reserva para ${servicio.title}${opcionSeleccionada ? ` - ${opcionSeleccionada.nombre}` : ""}`
      };
      console.log("Enviando datos de turno:", datosTurno);

      const timeoutId = setTimeout(() => {
        setLoading(false);
        setError("La solicitud ha tardado demasiado. Por favor, inténtalo de nuevo.");
      }, 15000); // 15 segundos de timeout

      try {
        setLoading(true);
        const response = await axios.post(
          "http://localhost:3001/api/turnos",
          datosTurno,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 segundos de timeout para axios
          }
        );

        clearTimeout(timeoutId);

        console.log("Respuesta recibida:", response.data);

        if (response.data && response.data.id_turno) {
          const detallesReserva = {
            id_turno: response.data.id_turno,
            servicio: servicio.title,
            opcion: opcionSeleccionada?.nombre,
            fecha,
            hora,
            profesional
          };
          onReservaConfirmada?.(detallesReserva);
          alert(
            `Tu reserva ha sido confirmada para el ${formatearFecha(
              fecha
            )} a las ${hora}.`
          );
          setTimeout(onClose, 1000);
        } else {
          throw new Error("La respuesta del servidor no incluyó el ID del turno");
        }
      } catch (err) {
        clearTimeout(timeoutId);

        console.error("Error al crear el turno:", err);

        if (err.response) {
          console.error("Error del servidor:", err.response.data);
          console.error("Estado HTTP:", err.response.status);
          setError(
            `Error del servidor: ${err.response.data?.error || err.response.status}`
          );
        } else if (err.request) {
          console.error("No se recibió respuesta del servidor:", err.request);
          setError(
            "No se recibió respuesta del servidor. Verifica tu conexión a internet."
          );
        } else {
          console.error("Error al configurar la solicitud:", err.message);
          setError(`Error: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const formatearFecha = fechaString => {
    const [año, mes, dia] = fechaString.split("-");
    return new Date(
      parseInt(año),
      parseInt(mes) - 1,
      parseInt(dia)
    ).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const volverPaso = () => setPaso(1);
  const seleccionarProfesional = prof => {
    setProfesional(`${prof.nombre} ${prof.apellido}`);
    setProfesionalId(prof.id_profesional);
    if (diaSeleccionado) {
      verificarDisponibilidad(diaSeleccionado, prof.id_profesional);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-reserva" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          ✕
        </button>
        {error && (
          <div className="error-mensaje">
            {error}
            <button onClick={() => setError(null)}>Cerrar</button>
          </div>
        )}
        <div className="modal-body">
          {/* Imagen y resumen */}
          <div className="modal-image-container">
            <img src={servicio.imageSrc} alt={servicio.title} className="modal-img" />
            <div className="modal-image-overlay">
              <h2 className="modal-reserva-title">Reservar Turno</h2>
              <div className="modal-servicio-info">
                <h3>{servicio.title}</h3>
                {opcionSeleccionada && (
                  <p className="modal-opcion-elegida">{opcionSeleccionada.nombre}</p>
                )}
                <p className="modal-precio">
                  ${opcionSeleccionada ? opcionSeleccionada.precio : servicio.precio}
                </p>
              </div>
            </div>
          </div>

          {/* Detalles y formulario */}
          <div className="modal-details modal-reserva-details">
            <div className="modal-pasos-indicador">
              <div className={`paso ${paso >= 1 ? "activo" : ""}`}>1. Fecha y Hora</div>
              <div className="paso-separador" />
              <div className={`paso ${paso >= 2 ? "activo" : ""}`}>2. Profesional</div>
            </div>

            <form onSubmit={handleSubmit} className="modal-reserva-form">
              {paso === 1 ? (
                <div className="modal-paso modal-paso-1">
                  <div className="calendario-container">
                    <CalendarioPersonalizado
                      onSeleccionarFechaHora={handleFechaHoraSeleccionada}
                      fechaSeleccionada={diaSeleccionado}
                      horaSeleccionada={hora}
                      turnosOcupados={turnosOcupados}
                      profesionalId={profesionalId}
                      profesionales={profesionales}
                    />
                  </div>
                </div>
              ) : (
                <div className="modal-paso modal-paso-2">
                  <div className="form-group">
                    <label>Selecciona un profesional:</label>
                    {loading ? (
                      <p>Cargando profesionales...</p>
                    ) : (
                      <div className="profesionales-grid">
                        {profesionales.length > 0 ? (
                          profesionales.map(prof => (
                            <div
                              key={prof.id_profesional}
                              className={`profesional-card ${profesionalId === prof.id_profesional ? "seleccionado" : ""
                                }`}
                              onClick={() => seleccionarProfesional(prof)}
                            >
                              <div className="profesional-avatar">{prof.nombre.charAt(0)}</div>
                              <div className="profesional-info">
                                <h4>{`${prof.nombre} ${prof.apellido}`}</h4>
                                <p>{servicio.title}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p>No hay profesionales disponibles para este servicio.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="resumen-reserva">
                    <h4>Resumen de la reserva</h4>
                    <p><strong>Servicio:</strong> {servicio.title}</p>
                    {opcionSeleccionada && <p><strong>Opción:</strong> {opcionSeleccionada.nombre}</p>}
                    <p><strong>Fecha:</strong> {formatearFecha(fecha)}</p>
                    <p><strong>Hora:</strong> {hora}</p>
                  </div>
                </div>
              )}

              <div className="modal-button-container">
                {paso === 2 && (
                  <button type="button" className="modal-volver-btn" onClick={volverPaso}>
                    Volver
                  </button>
                )}
                <button type="submit" className="modal-reservar-btn" disabled={loading}>
                  {loading ? "Procesando..." : paso === 1 ? "Continuar" : "Confirmar Reserva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarioPersonalizado = ({
  onSeleccionarFechaHora,
  fechaSeleccionada,
  horaSeleccionada,
  turnosOcupados = [],
  profesionalId,
  profesionales = []
}) => {
  const today = new Date();
  const [fechaActual, setFechaActual] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [diaSeleccionado, setDiaSeleccionado] = useState(
    fechaSeleccionada || today
  );
  const [horaElegida, setHoraElegida] = useState(horaSeleccionada || null);

  useEffect(() => {
    if (!fechaSeleccionada) {
      onSeleccionarFechaHora(today, horaElegida);
    }
  }, []);

  const obtenerDiasDelMes = fecha => {
    const dias = [];
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const totalDias = new Date(año, mes + 1, 0).getDate();
    const primerDia = new Date(año, mes, 1).getDay();

    // Ajustar para que la semana empiece en domingo (0) o lunes (1)
    const primerDiaAjustado = primerDia === 0 ? 7 : primerDia;

    // Días del mes anterior para completar la primera semana
    const diasAnteriores = primerDiaAjustado - 1;
    const diasAnteriorMes = new Date(año, mes, 0).getDate();

    for (let i = diasAnteriores; i > 0; i--) {
      dias.push({
        fecha: new Date(año, mes, 1 - i),
        esDelMesActual: false
      });
    }

    // Días del mes actual
    for (let i = 1; i <= totalDias; i++) {
      const fechaDia = new Date(año, mes, i);
      dias.push({
        fecha: fechaDia,
        esDelMesActual: true,
        esPasado: fechaDia < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        esHoy: fechaDia.getDate() === today.getDate() &&
          fechaDia.getMonth() === today.getMonth() &&
          fechaDia.getFullYear() === today.getFullYear()
      });
    }

    const diasSiguientes = 42 - dias.length; // 6 filas * 7 días = 42
    for (let i = 1; i <= diasSiguientes; i++) {
      dias.push({
        fecha: new Date(año, mes + 1, i),
        esDelMesActual: false
      });
    }

    return dias;
  };

  const cambiarMes = offset => {
    const nuevoMes = new Date(fechaActual);
    nuevoMes.setMonth(fechaActual.getMonth() + offset);
    setFechaActual(new Date(nuevoMes.getFullYear(), nuevoMes.getMonth(), 1));
  };

  const seleccionarDia = dia => {
    if (
      dia.getTime() <
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    )
      return;
    setDiaSeleccionado(dia);
    onSeleccionarFechaHora(dia, horaElegida);
  };

  const seleccionarHora = hora => {
    setHoraElegida(hora);
    onSeleccionarFechaHora(diaSeleccionado, hora);
  };

  const estaHoraOcupada = (hora) => {
    if (!diaSeleccionado) return false;

    const fechaStr = diaSeleccionado.toISOString().split("T")[0];

    if (profesionalId) {
      return turnosOcupados.some(turno => {
        const turnoFecha = new Date(turno.fecha_hora).toISOString().split("T")[0];
        const turnoHora = new Date(turno.fecha_hora).toTimeString().substring(0, 5);

        return turnoFecha === fechaStr &&
          turnoHora === hora &&
          turno.id_profesional === profesionalId;
      });
    }

    const allProfesionales = profesionales.map(prof => prof.id_profesional);

    const profesionalesOcupados = new Set();

    turnosOcupados.forEach(turno => {
      const turnoFecha = new Date(turno.fecha_hora).toISOString().split("T")[0];
      const turnoHora = new Date(turno.fecha_hora).toTimeString().substring(0, 5);

      if (turnoFecha === fechaStr && turnoHora === hora) {
        profesionalesOcupados.add(turno.id_profesional);
      }
    });

    return profesionalesOcupados.size === allProfesionales.length && allProfesionales.length > 0;
  };

  const dias = obtenerDiasDelMes(fechaActual);
  const nombreMes = fechaActual.toLocaleString("es-ES", {
    month: "long",
    year: "numeric"
  });

  const diasSemana = ["L", "M", "X", "J", "V", "S", "D"];

  const horarios = {
    mañana: ["08:00", "09:00", "10:00", "11:00", "12:00"],
    tarde: ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
    noche: ["19:00", "20:00", "21:00"]
  };

  return (
    <div className="calendario-custom">
      <h4 className="titulo-seleccion">
        Seleccioná fecha y hora de tu servicio
      </h4>
      <div className="encabezado">
        <button type="button" onClick={() => cambiarMes(-1)}>
          ←
        </button>
        <h5>
          {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}
        </h5>
        <button type="button" onClick={() => cambiarMes(1)}>
          →
        </button>
      </div>

      {/* Cuadrícula de días de la semana */}
      <div className="dias-semana">
        {diasSemana.map(dia => (
          <div key={dia} className="dia-semana">{dia}</div>
        ))}
      </div>

      {/* Cuadrícula de días del mes */}
      <div className="dias-grid">
        {dias.map((dia, index) => (
          <div
            key={index}
            className={`dia-grid ${!dia.esDelMesActual ? "otro-mes" : ""} ${dia.esPasado ? "pasado" : ""
              } ${diaSeleccionado?.toDateString() === dia.fecha.toDateString()
                ? "seleccionado" : ""
              } ${dia.esHoy ? "hoy" : ""
              }`}
            onClick={() =>
              dia.esDelMesActual && !dia.esPasado && seleccionarDia(dia.fecha)
            }
          >
            {dia.fecha.getDate()}
          </div>
        ))}
      </div>

      {diaSeleccionado && (
        <div className="horarios">
          <h5>
            Horarios disponibles para el{" "}
            {diaSeleccionado.toLocaleDateString("es-ES")}
          </h5>
          {Object.entries(horarios).map(([turno, horas]) => (
            <div className="bloque-horario" key={turno}>
              <h6>{turno.charAt(0).toUpperCase() + turno.slice(1)}</h6>
              <div className="horarios-lista">
                {horas.map((hora, idx) => {
                  const ocupado = estaHoraOcupada(hora);
                  return (
                    <button
                      key={idx}
                      className={`horario-btn ${horaElegida === hora ? "seleccionado" : ""
                        } ${ocupado ? "ocupado" : ""}`}
                      onClick={() => !ocupado && seleccionarHora(hora)}
                      disabled={ocupado}
                    >
                      {hora}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModalReserva;