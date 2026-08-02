import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Logro, LogroDocument, LogroElement } from './schemas/logro.schema';

type SeedDay = { day: number; elementText: string; userText: string };

const SEED: Array<{ element: LogroElement; days: SeedDay[] }> = [
  {
    element: 'bonsai',
    days: [
      {
        day: 1,
        elementText:
          'Hoy plantamos una semilla que nadie ve, nadie nota, pero tú sabes que está ahí. De momento nada ha cambiado, pero cada día la semilla irá creciendo. Eso sí: hay que darle agua, luz y cuidarla. Si un día no lo haces, irá muriendo lentamente.',
        userText:
          '{name}, así como el bonsái, hoy has sembrado tu objetivo y propósito. Debes darle todos los días una hora de dedicación, regarlo con un nuevo aprendizaje y salir a darle luz que tú lo veas. Hoy no ha cambiado nada, pero sí ha nacido algo. Si un día lo dejas, irá muriendo lentamente.',
      },
      {
        day: 2,
        elementText:
          'La semilla ya está bajo tierra. Aún no hay tallo a la vista, pero las raíces buscan su sitio en silencio. Un riego constante vale más que un diluvio de un solo día.',
        userText:
          '{name}, tu segundo día no pide espectáculo: pide repetición. Vuelve a tu hora, vuelve a tu cuidado. Lo invisible de ayer sigue vivo si hoy no lo abandonas.',
      },
      {
        day: 3,
        elementText:
          'Aparece el primer brote tímido. No es un árbol todavía; es una promesa verde. Quien lo arranca por impaciencia nunca verá la copa.',
        userText:
          '{name}, tres días ya son un ritmo. No midas el tamaño del árbol: mide si volviste. La paciencia no grita; simplemente no se va.',
      },
    ],
  },
  {
    element: 'gem',
    days: [
      {
        day: 1,
        elementText:
          'Hoy tienes una piedra en bruto. Nadie ve el brillo que esconde. El primer golpe de cincel no la hace gema; solo abre el camino. Sin pulido diario, se queda opaca para siempre.',
        userText:
          '{name}, hoy elegiste pulir tu gema. Empieza sin luces ni aplausos. Una hora de dedicación es el primer roce que quita polvo. Si dejas de pulir, la piedra se queda como estaba.',
      },
      {
        day: 2,
        elementText:
          'Sigue el polvo fino cayendo. La forma aún es tosca, pero ya hay una cara más limpia. El artesano no pregunta si ya brilla; pregunta si ha vuelto al taller.',
        userText:
          '{name}, el segundo día es cuando la mente quiere resultados. Tú vuelve al cincel. Cada sesión corta una impureza que ayer todavía te pesaba.',
      },
      {
        day: 3,
        elementText:
          'Aparece un destello tenue en un ángulo. No es el joyero terminado, pero ya hay luz propia. Quien abandona aquí pierde el brillo que apenas empezaba.',
        userText:
          '{name}, tres días de pulido ya dejan huella. No busques la joya perfecta aún; busca la constancia que hace posible que un día brille de verdad.',
      },
    ],
  },
  {
    element: 'sword',
    days: [
      {
        day: 1,
        elementText:
          'Hoy el metal entra en el fuego. Todavía no es espada: es posibilidad al rojo. Sin calor diario y sin martillo paciente, se enfría y se queda en lingote inútil.',
        userText:
          '{name}, hoy empezaste a forjar. Una hora al fuego de tu propósito. Golpea con aprendizaje, temple con disciplina. Si un día apagas la fragua, el metal pierde forma.',
      },
      {
        day: 2,
        elementText:
          'El martillo cae otra vez. El metal se estira, se dobla, se corrige. El herrero no espera una hoja perfecta al segundo golpe; confía en la serie.',
        userText:
          '{name}, el segundo día duele un poco más: es el calor real. Vuelve a la fragua. Cada repetición alinea el filo que aún no ves.',
      },
      {
        day: 3,
        elementText:
          'Ya se adivina el contorno de una hoja. No corta batallas todavía, pero ya tiene dirección. Quien deja de forjar aquí forja solo arrepentimiento.',
        userText:
          '{name}, tres días en el fuego ya cambian el metal. No midas la espada terminada; midas si hoy volviste a golpear con intención.',
      },
    ],
  },
  {
    element: 'diamond',
    days: [
      {
        day: 1,
        elementText:
          'Hoy hay carbón bajo presión. Nadie ve diamante. La tierra no tiene prisa: aprieta en silencio. Sin presión constante, nunca habrá cristal.',
        userText:
          '{name}, hoy aceptaste la presión de tu propósito. Una hora diaria es esa fuerza invisible. Si aflojas un día tras otro, el diamante no nace.',
      },
      {
        day: 2,
        elementText:
          'La presión sigue. El interior se reordena sin espectáculo. El diamante no anuncia su llegada; se forma en la oscuridad del tiempo.',
        userText:
          '{name}, el segundo día parece igual al primero. Eso es bueno. La transformación profunda no hace ruido. Mantén la presión de tu hábito.',
      },
      {
        day: 3,
        elementText:
          'Empieza a nacer una estructura dura. Aún no brilla en un anillo, pero ya no es solo carbón. Quien suelta la presión aquí vuelve al polvo.',
        userText:
          '{name}, tres días de presión ya cuentan. No busques el diamante terminado; busca no soltar lo que ayer empezaste a comprimir con paciencia.',
      },
    ],
  },
];

@Injectable()
export class LogroSeedService implements OnModuleInit {
  private readonly logger = new Logger(LogroSeedService.name);

  constructor(
    @InjectModel(Logro.name) private readonly logroModel: Model<LogroDocument>,
  ) {}

  async onModuleInit() {
    for (const item of SEED) {
      const existing = await this.logroModel.findOne({ element: item.element }).exec();
      if (existing) {
        // Completa días faltantes sin pisar textos ya editados a mano.
        const have = new Set((existing.days || []).map((d) => d.day));
        const missing = item.days.filter((d) => !have.has(d.day));
        if (missing.length) {
          existing.days = [...(existing.days || []), ...missing].sort(
            (a, b) => a.day - b.day,
          );
          await existing.save();
          this.logger.log(`logro/${item.element}: +${missing.length} días`);
        }
        continue;
      }
      await this.logroModel.create(item);
      this.logger.log(`Seed logro/${item.element}: ${item.days.length} días`);
    }
  }
}
