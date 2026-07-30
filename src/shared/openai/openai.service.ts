import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { RagCategory } from '../../modules/habits/schemas/rag-chunk.schema';

export interface HabitAiAnalysis {
  groupKey: string;
  groupName: string;
  description: string;
  scopePrompt: string;
  identityTitle: string;
  identityRole: string;
  identityTagline: string;
  ragChunks: Array<{
    title: string;
    content: string;
    category: RagCategory;
  }>;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('Falta OPENAI_API_KEY en el .env');
    }
    this.client = new OpenAI({ apiKey });
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
  }

  /**
   * Analiza el hábito del usuario, asigna/crea grupo, identidad y RAG inicial.
   * Todo acotado a un solo dominio para evitar confusiones futuras.
   */
  async analyzeHabit(habitRaw: string, existingGroupNames: string[]): Promise<HabitAiAnalysis> {
    const maxTokens = Number(this.config.get('OPENAI_MAX_OUTPUT_TOKENS') ?? 3000);

    const system = `Eres el motor de identidad de ACROBIT.
ACROBIT NO es una agenda: ayuda a construir PACIENCIA y DISCIPLINA alrededor de UN hábito.
Tu trabajo: clasificar el hábito en UN grupo, crear una identidad psicológica creíble, y generar conocimiento RAG solo de ese dominio.

Reglas estrictas:
- Responde SOLO JSON válido (sin markdown).
- Un solo dominio. Nada de mezclar temas.
- groupKey: snake_case corto en inglés (ej. muscle_gain, learn_english, driving).
- Si el hábito encaja con un grupo existente, REUTILIZA exactamente ese groupKey/name.
- identityTitle: en mayúsculas, corto, imponente (ej. "ATLETA EN FORJA").
- identityRole: título creíble de oficio/identidad (ej. "Deportista disciplinado", "Futbolista semiprofesional", "Hablante de inglés en construcción").
- identityTagline: 1 frase que refuerce identidad + paciencia.
- ragChunks: 6 a 8 piezas. Categorías SOLO: lifestyle | practice | patience | identity.
- Cada chunk: contenido concreto del día a día de gente que YA vive ese hábito.
- scopePrompt: instrucción corta para futuras IAs: "Solo habla de X. Nunca inventes otros hábitos."
- Tono serio, elegante, motivador (sin infantilismos).`;

    const user = `Hábito del usuario: """${habitRaw}"""

Grupos ya existentes (reutiliza si encaja):
${existingGroupNames.length ? existingGroupNames.join(', ') : '(ninguno aún)'}

Devuelve exactamente este JSON:
{
  "groupKey": "string",
  "groupName": "string",
  "description": "string",
  "scopePrompt": "string",
  "identityTitle": "string",
  "identityRole": "string",
  "identityTagline": "string",
  "ragChunks": [
    { "title": "string", "content": "string", "category": "lifestyle|practice|patience|identity" }
  ]
}`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    this.logger.log(`Análisis IA recibido (${raw.length} chars)`);

    const parsed = JSON.parse(raw) as HabitAiAnalysis;
    return this.normalize(parsed);
  }

  private normalize(data: HabitAiAnalysis): HabitAiAnalysis {
    const allowed = new Set(Object.values(RagCategory));
    const chunks = (data.ragChunks ?? [])
      .filter((c) => c?.title && c?.content)
      .map((c) => ({
        title: String(c.title).trim(),
        content: String(c.content).trim(),
        category: allowed.has(c.category as RagCategory)
          ? (c.category as RagCategory)
          : RagCategory.PRACTICE,
      }));

    if (chunks.length < 4) {
      throw new Error('La IA no generó suficiente conocimiento RAG para el hábito.');
    }

    return {
      groupKey: String(data.groupKey || 'general_habit').toLowerCase().trim().replace(/\s+/g, '_'),
      groupName: String(data.groupName || 'Hábito').trim(),
      description: String(data.description || '').trim(),
      scopePrompt: String(
        data.scopePrompt ||
          `Solo habla del hábito "${data.groupName}". Nunca mezcles otros temas.`,
      ).trim(),
      identityTitle: String(data.identityTitle || 'MIEMBRO ACROBIT').trim().toUpperCase(),
      identityRole: String(data.identityRole || 'Practicante disciplinado').trim(),
      identityTagline: String(
        data.identityTagline || 'La paciencia construye lo que la prisa destruye.',
      ).trim(),
      ragChunks: chunks,
    };
  }

  /**
   * Bienvenida emotiva de primera vez: paciencia + disciplina + hábito concreto.
   */
  async generateWelcomeMessage(input: {
    name: string;
    habitRaw: string;
    identityTitle?: string;
    identityRole?: string;
    groupName?: string;
    scopePrompt?: string;
    ragSnippets?: string[];
  }): Promise<string> {
    const snippets = (input.ragSnippets ?? []).slice(0, 4).join('\n- ');
    const system = `Eres la voz de ACROBIT: serena, sabia, moderna.
ACROBIT NO es una agenda. Enseñas PACIENCIA y DISCIPLINA.
Escribes la bienvenida de PRIMERA VEZ al chat.
Reglas:
- Español natural, emotivo, sin cursilería barata.
- 2 a 4 párrafos cortos (máx ~120 palabras en total).
- Habla SOLO del hábito/dominio del usuario.
- Dale la bienvenida, nómbralo, refuerza su identidad.
- Deja claro que aquí no se corre: se construye día a día.
- No uses markdown ni listas. Solo texto.
- No inventes otros hábitos.
${input.scopePrompt ? `Alcance: ${input.scopePrompt}` : ''}`;

    const user = `Nombre: ${input.name}
Hábito: ${input.habitRaw}
Identidad: ${input.identityTitle || ''} — ${input.identityRole || ''}
Grupo: ${input.groupName || ''}
Contexto RAG (opcional):
- ${snippets || 'ninguno'}

Escribe el mensaje de bienvenida.`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const text = (completion.choices[0]?.message?.content || '').trim();
    if (!text) {
      throw new Error('La IA no generó el mensaje de bienvenida.');
    }
    return text;
  }
}
