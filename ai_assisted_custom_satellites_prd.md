# PRD: AI-Assisted Custom Satellites

## Product Summary

Gravity permite que el usuario cree sus propios tipos de Satellite describiendo en
lenguaje natural la herramienta que necesita. La IA traduce esa intención a una
definición estructurada y segura que Gravity puede validar y renderizar sin
ejecutar código generado.

El resultado no se inserta en una Note. Se guarda como un **Custom Satellite
Type** reutilizable dentro del **Satellite Hub**. Cada vez que el usuario lo abre,
Gravity crea una **Satellite Instance** flotante con datos independientes.

## Problem

Los Satellite Types incluidos por Gravity no pueden cubrir todas las herramientas
pequeñas y personales que un usuario puede necesitar. Un constructor técnico
obligaría al usuario a entender campos, esquemas, layouts y validaciones, mientras
que permitir código arbitrario introduciría riesgos de seguridad y confiabilidad.

Gravity necesita una forma limitada y predecible de convertir una descripción
humana en un Satellite útil, sin convertir al usuario en programador ni a la IA
en un generador de plugins.

## Goal

Permitir que un usuario cree, revise y guarde un Custom Satellite Type desde el
Satellite Hub mediante una experiencia asistida por IA.

El usuario debe sentir que está describiendo una pequeña herramienta:

> "Quiero una tarjeta para organizar personajes de una novela."

No que está programando un componente.

## Domain Decisions

### Custom Satellite Type

Una definición reutilizable creada por el usuario y renderizada por Gravity. No
contiene JavaScript, HTML, CSS ni otra forma de código ejecutable.

Un Custom Satellite Type pertenece al Notebook y aparece en la sección
**My Satellites** del Satellite Hub.

En el MVP, un Custom Satellite Type es exclusivamente una definición de datos:
describe qué información captura una instancia y cómo la presenta. No define
acciones, cálculos, temporizadores ni procesos.

### Satellite Instance

Una aparición flotante de un Custom Satellite Type sobre el Canvas. Cada
Satellite Instance:

- referencia exactamente un Custom Satellite Type;
- mantiene sus propios datos;
- puede coexistir con otras instancias del mismo tipo;
- es global al Notebook, no pertenece a la Note activa;
- permanece visible al cambiar de Note.

### Satellite Creator

Una superficie temporal abierta desde **Create Satellite** en el Satellite Hub.
Está dedicada exclusivamente a crear o revisar un Custom Satellite Type.

El Satellite Creator:

- no es un Satellite;
- no es un Thread ni un chat general;
- no conserva un historial de conversación permanente;
- no accede al contenido de Notes, Folders o Threads;
- no modifica el Notebook Root;
- solo puede producir una propuesta compatible con el esquema permitido.

## Core Flow

1. El usuario abre el Satellite Hub.
2. Selecciona **Create Satellite**.
3. Gravity abre el Satellite Creator.
4. El usuario describe la herramienta que necesita.
5. La IA propone un Custom Satellite Type estructurado.
6. Gravity valida la propuesta antes de mostrarla.
7. El usuario ve un preview funcional.
8. El usuario puede pedir un ajuste acotado o editar opciones básicas.
9. El usuario confirma la propuesta.
10. Gravity guarda el Custom Satellite Type en **My Satellites**.
11. El usuario lo arrastra o abre desde el Satellite Hub.
12. Gravity crea una nueva Satellite Instance con datos independientes.

Cancelar el Satellite Creator no crea ni modifica ningún Custom Satellite Type.

## Satellite Hub

```text
Satellite Hub
├── Built-in Satellites
│   ├── Quick Note
│   ├── Calendar
│   └── Pomodoro
├── My Satellites
│   └── Character Profile
└── + Create Satellite
```

Un Custom Satellite Type puede abrir múltiples Satellite Instances. Las reglas
singleton de Calendar y Pomodoro no se aplican automáticamente a tipos creados
por el usuario.

## Satellite Creator UX

### Description

Pregunta principal:

> What should this Satellite help you do?

Ejemplo:

> "I want a Satellite to organize characters for my dark fantasy story."

Acción principal:

> Generate Satellite

### Preview

El preview muestra:

- nombre;
- descripción breve;
- icono;
- información incluida;
- datos de ejemplo claramente identificados como preview.

El usuario no ve JSON, schemas ni nombres técnicos de tipos.

### Revision

El usuario puede:

- cambiar nombre, icono y color;
- renombrar, reordenar, agregar o quitar información;
- pedir ajustes breves, por ejemplo: "Quita edad y agrega relaciones";
- regenerar la propuesta;
- guardar o cancelar.

Las revisiones operan únicamente sobre la propuesta actual. No son una
conversación abierta ni habilitan capacidades adicionales.

## MVP Capabilities

Un Custom Satellite Type del MVP puede capturar y mostrar únicamente valores de
los siguientes tipos:

```ts
type SatelliteValueType =
  | "shortText"
  | "longText"
  | "number"
  | "date"
  | "singleSelect"
  | "multiSelect"
  | "checkbox"
  | "progress"
  | "image";
```

### Value Rules

- `shortText` almacena una sola línea de texto.
- `longText` almacena texto de varias líneas sin formato ejecutable.
- `number` almacena un número finito.
- `date` almacena una fecha de calendario, sin hora ni recurrencia.
- `singleSelect` almacena una opción de un catálogo definido en el tipo.
- `multiSelect` almacena cero o más opciones del catálogo definido en el tipo.
- `checkbox` almacena un valor verdadero o falso.
- `progress` almacena un número entre 0 y 100.
- `image` almacena una referencia gestionada por Gravity a una imagen local
  elegida por el usuario.

Todos los valores son editados explícitamente por el usuario. No se calculan, no
se actualizan por tiempo y no desencadenan efectos.

### Explicit Capability Boundary

Un Custom Satellite Type del MVP no puede:

- ejecutar acciones o comandos;
- derivar un valor de otros valores;
- usar fórmulas o validaciones creadas por el usuario;
- iniciar timers, alarmas o recordatorios;
- reaccionar a una fecha;
- ejecutarse o actualizarse en background;
- acceder a red, filesystem, clipboard o APIs del sistema;
- enviar notificaciones;
- modificar una Note u otro Satellite;
- contener enlaces activos o archivos distintos de imágenes.

Built-in Satellite Types como Calendar y Pomodoro conservan sus comportamientos
especializados. Esos comportamientos no forman parte del sistema de Custom
Satellite Types.

## MVP Appearance

Todos los Custom Satellite Types usan una única apariencia `card`.

```ts
type SatelliteAppearance = "card";
```

La tarjeta:

- muestra nombre e icono en un encabezado compartido;
- presenta las propiedades en el orden definido por el tipo;
- usa una sola columna;
- adapta el ancho de los controles al ancho disponible;
- permite redimensionar la Satellite Instance dentro de límites controlados;
- usa scroll interno cuando el contenido supera la altura disponible;
- conserva la misma estructura en preview y en la instancia guardada.

La IA no selecciona, describe ni configura el layout. El usuario puede reordenar
las propiedades, pero no diseñar una grilla ni posicionarlas libremente.

Table, gallery, timeline, tracker y otras apariencias quedan fuera del MVP. Si se
añaden más adelante, serán renderers controlados por Gravity, no layouts
generados libremente.

## AI Responsibilities

La IA actúa solamente como traductor de intención a una propuesta estructurada.

Puede proponer:

- nombre y descripción;
- icono de un catálogo permitido;
- información que la instancia almacenará;
- etiquetas, opciones y valores iniciales;
- datos ficticios para el preview.

No puede:

- guardar directamente un Custom Satellite Type;
- crear una Satellite Instance;
- leer Notes, Folders, Threads o archivos;
- generar o ejecutar JavaScript, HTML, CSS, SQL o scripts;
- realizar llamadas de red o integraciones externas;
- crear automatizaciones o acciones del sistema;
- ampliar por sí misma el conjunto de capacidades permitido.

## Structured Definition

El contrato exacto deberá vivir en el dominio y ser independiente del proveedor
de IA. Este modelo expresa el límite inicial:

```ts
type CustomSatelliteType = {
  id: string;
  name: string;
  description?: string;
  icon?: AllowedSatelliteIcon;
  appearance: SatelliteAppearance;
  properties: SatelliteProperty[];
  createdAt: string;
  updatedAt: string;
};

type SatelliteProperty = {
  id: string;
  key: string;
  label: string;
  valueType: SatelliteValueType;
  required: boolean;
  options?: string[];
  defaultValue?: SatelliteValue;
};

type SatelliteValue =
  | string
  | number
  | boolean
  | string[]
  | { imageId: string };

type SatelliteInstance = {
  id: string;
  customTypeId: string;
  data: Record<string, SatelliteValue>;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  createdAt: string;
  updatedAt: string;
};
```

Cada valor debe validarse de acuerdo con el `valueType` de su propiedad. Las
fechas usan una representación canónica `YYYY-MM-DD`; las selecciones solo pueden
contener opciones declaradas; los números deben ser finitos; y el progreso debe
permanecer entre 0 y 100.

`appearance` solo admite `"card"` en el MVP. El contrato no utilizará `any`.

## Validation And Safety

Gravity trata toda respuesta de la IA como entrada no confiable.

Antes del preview y antes de guardar:

- la respuesta debe satisfacer el schema versionado;
- todos los enums deben pertenecer a catálogos controlados por Gravity;
- las claves deben ser únicas y usar caracteres seguros;
- nombre, etiquetas, opciones y descripciones tienen límites de longitud;
- el número de propiedades y opciones tiene límites estrictos;
- los valores iniciales deben corresponder con su tipo;
- contenido ejecutable o propiedades desconocidas se rechazan;
- una definición inválida nunca se guarda parcialmente;
- un error de generación conserva la descripción del usuario para reintentar.

No se intentará detectar "prompt injection" mediante búsquedas de texto como
mecanismo principal. La seguridad proviene de un output schema cerrado, validación
estricta y ausencia de capacidades ejecutables.

## Architecture Boundaries

### Domain

Define el contrato versionado, sus invariantes y la validación pura de Custom
Satellite Types y Satellite Instances. No depende de UI, Electron ni del SDK de
un proveedor de IA.

### Application

Orquesta los casos de uso:

- generar una propuesta;
- revisar una propuesta;
- confirmar o cancelar;
- listar Custom Satellite Types;
- crear una Satellite Instance desde un tipo guardado.

Define puertos para generación y persistencia.

### Adapters

Implementa:

- el proveedor de IA;
- structured output;
- persistencia de tipos e instancias;
- traducción de errores externos a errores de aplicación.

### Desktop

Compone los servicios y presenta:

- Create Satellite en el Satellite Hub;
- Satellite Creator;
- preview y edición visual;
- My Satellites;
- renderer genérico de Satellite Instances.

El renderer no llama directamente al proveedor de IA ni valida contratos por su
cuenta.

## MVP Scope

El MVP incluye:

- entrada **Create Satellite** en el Satellite Hub;
- descripción mediante lenguaje natural;
- una propuesta estructurada por generación;
- validación estricta;
- preview funcional;
- edición visual básica;
- confirmación y cancelación;
- persistencia de Custom Satellite Types;
- sección **My Satellites**;
- múltiples Satellite Instances independientes por tipo;
- captura y visualización de texto, números, fechas, selecciones, checks,
  progreso e imágenes;
- una única apariencia de tarjeta adaptable con scroll interno;
- estados claros de carga, error y reintento.

## Non-Goals

- insertar Satellites dentro del markdown de una Note;
- ligar una Satellite Instance a la Note activa;
- acceso de la IA al Notebook Root;
- uso del Scratchpad de Notes;
- chat general o historial conversacional permanente;
- creación manual desde cero;
- layouts alternativos como table, gallery, timeline o tracker;
- diseño libre, grillas o posicionamiento de propiedades;
- marketplace o compartir tipos;
- importación o exportación;
- plugins o código generado por usuarios o IA;
- HTML, CSS o JavaScript personalizados;
- APIs o integraciones externas;
- fórmulas, scripting o automatizaciones;
- timers, recordatorios, notificaciones o comportamiento en background;
- valores calculados o acciones disparadas por cambios;
- modificación de Built-in Satellite Types;
- creación de nuevos tipos con ciclo de vida en background como Calendar o
  Pomodoro.

## Success Criteria

- El usuario puede pasar de una descripción a un tipo guardado sin ver conceptos
  técnicos.
- Ninguna salida inválida de la IA alcanza la persistencia.
- Cambiar de Note no cambia ni oculta una Satellite Instance.
- Dos instancias del mismo Custom Satellite Type mantienen datos independientes.
- Cancelar o fallar durante la creación no deja tipos ni instancias parciales.
- Los tipos guardados reaparecen en My Satellites después de reiniciar Gravity.

## Open Product Decisions

- Gestión, almacenamiento y eliminación de imágenes locales.
- Comportamiento al editar un Custom Satellite Type que ya tiene instancias.
- Eliminación de un tipo que todavía tiene instancias o datos.
- Proveedor de IA, selección de modelo y estrategia offline.
- Límites de uso, cancelación y timeouts de generación.
