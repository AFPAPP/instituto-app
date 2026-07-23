export type Rol = 'profesor' | 'direccion'
export type Modalidad = 'Presencial' | 'Virtual' | 'Híbrido'
export type EstadoModulo = 'por_iniciar' | 'en_curso' | 'finalizado' | 'pausado'
export type EstadoPago = 'pagado' | 'pendiente' | 'becado'

export interface Profesor {
  id: string
  user_id: string
  nombre: string
  email: string
  rol: Rol
  created_at: string
}

export interface Modulo {
  id: string
  nivel: string
  modulo: string
  grupo: string
  profesor_id: string
  modalidad: Modalidad
  dias: string[]
  horas_sesion: number
  fecha_inicio: string | null
  fecha_fin: string | null
  precio_mes: number
  estado: EstadoModulo
  created_at: string
  // Joins
  profesores?: Profesor
}

export interface Estudiante {
  id: string
  modulo_id: string
  apellido: string
  nombre: string
  descuento_pct: number
  estado_pago: EstadoPago
  created_at: string
  // Joins
  modulos?: Modulo
}

export interface Sesion {
  id: string
  modulo_id: string
  fecha: string
  numero_clase: number
}

export interface Asistencia {
  id: string
  sesion_id: string
  estudiante_id: string
  asistio: boolean
  // Joins
  sesiones?: Sesion
  estudiantes?: Estudiante
}

export interface Nota {
  id: string
  estudiante_id: string
  p_oral: number | null
  p_escrita: number | null
  c_oral: number | null
  c_escrita: number | null
  updated_at: string
}

export interface Feriado {
  id: string
  fecha: string
  descripcion: string | null
}

export interface VistaResumen {
  estudiante_id: string
  apellido: string
  nombre: string
  descuento_pct: number
  estado_pago: EstadoPago
  modulo_id: string
  nivel: string
  modulo: string
  grupo: string
  precio_mes: number
  meses: number | null
  profesor_id: string
  profesor_nombre: string
  horas_programadas: number
  horas_asistidas: number
  porcentaje_asistencia: number
  p_oral: number | null
  p_escrita: number | null
  c_oral: number | null
  c_escrita: number | null
  nota_total: number | null
  subtotal_sin_descuento: number
  total_a_pagar: number
}
