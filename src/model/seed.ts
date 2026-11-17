import type { HypothesisMap } from '../types';

/**
 * Демо-карты. «Притча о гончаре» — дословный пример из базы знаний
 * (docs/knowledge-base/hypothesismapping/strategyascode.md) с применённой
 * топологией «мотивация на отдельном уровне» (topology.md): мотивация вынесена
 * из текстов «потому что» самих гипотез. «Смены.Про» — витрина остальных
 * топологий: многоцелевая карта, метрики и мотивация на отдельных уровнях,
 * негативные субъекты, многоуровневая карта (task.childMapId, без стрелки).
 */

const GONCHAR_MAP: HypothesisMap = {
  schemaVersion: 1,
  meta: {
    title: 'Демо: Притча о гончаре (пример из базы знаний)',
    version: 1,
    date: '2026-11-16',
  },
  goal: {
    id: 'goal-pots',
    description: 'Обезопасить свою продукцию',
    metrics: [
      {
        id: 'metric-broken',
        description: 'Разбитые мальчишками горшки',
        current: 'разбивают все и каждый день',
        target: '0',
      },
    ],
  },
  subjects: [
    { id: 'subject-boys', description: 'Соседские мальчишки', influence: 'high' },
    { id: 'subject-parents', description: 'Родители мальчишек', influence: 'medium' },
  ],
  motivations: [
    {
      id: 'mo-pity',
      kind: 'wish',
      description: 'Жалость к бедному старику: мораль не позволяет издеваться',
      subject: 'subject-boys',
      influence: 'medium',
    },
    {
      id: 'mo-fear',
      kind: 'pain',
      description: 'Страх возмездия за порчу горшков',
      subject: 'subject-boys',
      influence: 'high',
    },
    {
      id: 'mo-pay',
      kind: 'wish',
      description: 'Заработок: хобби стало работой, мотивация зависит от оплаты',
      subject: 'subject-boys',
      influence: 'high',
    },
    {
      id: 'mo-help',
      kind: 'wish',
      description: 'Желание помочь старику и вразумить своих детей',
      subject: 'subject-parents',
      influence: 'medium',
    },
  ],
  hypotheses: [
    {
      id: 'hyp-pity',
      target: 'mo-pity',
      metrics: ['metric-broken'],
      influence: 'medium',
      cost: 'low',
      status: 'refuted',
      if: 'вызвать жалость к себе',
      then: 'им станет совестно бить горшки',
      because: 'их мораль запретит им издеваться над бедным стариком',
      so: 'число разбитых горшков снизится до нуля',
    },
    {
      id: 'hyp-threat',
      target: 'mo-fear',
      metrics: ['metric-broken'],
      influence: 'medium',
      cost: 'low',
      status: 'refuted',
      if: 'им угрожать',
      then: 'они испугаются',
      because: 'побоятся получить возмездие за порчу горшков',
      so: 'число разбитых горшков снизится до нуля',
    },
    {
      id: 'hyp-pay',
      target: 'mo-pay',
      metrics: ['metric-broken'],
      influence: 'high',
      cost: 'medium',
      status: 'confirmed',
      if: 'превратить хобби мальчишек в работу и перестать им платить',
      then: 'они не станут больше бить горшки',
      because: 'их мотивация стала зависима от оплаты, которой больше нет',
      so: 'число разбитых горшков снизится до нуля',
    },
    {
      id: 'hyp-parents',
      target: 'mo-help',
      metrics: ['metric-broken'],
      influence: 'medium',
      cost: 'low',
      status: 'to-verify',
      if: 'пожаловаться родителям на их детей',
      then: 'они решат вразумить своих детей',
      because: 'захотят помочь старику',
      so: 'число разбитых горшков снизится до нуля',
    },
  ],
  tasks: [
    {
      id: 'task-value',
      hypothesis: 'hyp-pity',
      description: 'Придумать описание ценности горшков в своей жизни',
    },
    {
      id: 'task-tell',
      hypothesis: 'hyp-pity',
      description: 'Донести эту информацию до мальчишек',
    },
    { id: 'task-threats', hypothesis: 'hyp-threat', description: 'Придумать угрозы' },
    {
      id: 'task-chase',
      hypothesis: 'hyp-threat',
      description: 'Догнать мальчишек и максимально реалистично угрожать им',
    },
    {
      id: 'task-budget',
      hypothesis: 'hyp-pay',
      description: 'Выделить бюджет на эксперимент',
    },
    {
      id: 'task-deal',
      hypothesis: 'hyp-pay',
      description: 'Договориться с мальчишками об оплате',
    },
    {
      id: 'task-less',
      hypothesis: 'hyp-pay',
      description: 'Платить им меньше с каждым днём',
    },
    {
      id: 'task-sad',
      hypothesis: 'hyp-pay',
      description:
        'Максимально реалистично, с грустью в глазах заявить, что денег больше нет',
    },
    { id: 'task-find', hypothesis: 'hyp-parents', description: 'Найти родителей' },
    {
      id: 'task-critical',
      hypothesis: 'hyp-parents',
      description: 'Донести до них критичность ситуации',
    },
    {
      id: 'task-deal-parents',
      hypothesis: 'hyp-parents',
      description: 'Договориться с ними, чтобы они оказали влияние на детей',
    },
  ],
  blockers: [],
};

const SMENNSY_MAP: HypothesisMap = {
  schemaVersion: 1,
  meta: {
    title: 'Демо: «Смены.Про» — стратегия роста',
    horizon: 'до конца 2027 года',
    version: 3,
    date: '2026-11-16',
  },
  goal: {
    id: 'goal-mrr',
    description: 'Удвоить выручку от новых клиентов за 12 месяцев',
    metrics: [],
  },
  goals: [
    {
      id: 'goal-market',
      description: 'Занять заметную долю рынка сменных сервисов',
      metrics: [],
    },
  ],
  metrics: [
    {
      id: 'metric-conversion',
      description: 'Конверсия триал → платный',
      current: '8%',
      target: '15%',
      goalRef: 'goal-mrr',
      influence: 'high',
    },
    {
      id: 'metric-churn',
      description: 'Отток клиентов в первые 3 месяца',
      current: '12%',
      target: '5%',
      balancing: true,
      goalRef: 'goal-mrr',
      influence: 'medium',
    },
    {
      id: 'metric-nps',
      description: 'NPS клиентов',
      current: '31',
      target: '45',
      goalRef: 'goal-mrr',
      influence: 'medium',
    },
    {
      id: 'metric-share',
      description: 'Доля рынка сменных сервисов',
      current: '4%',
      target: '12%',
      goalRef: 'goal-market',
      influence: 'high',
    },
  ],
  subjects: [
    {
      id: 'subject-lead',
      description: 'Начальники смен производств',
      influence: 'high',
      goals: ['goal-mrr', 'goal-market'],
      metrics: ['metric-conversion', 'metric-share'],
    },
    {
      id: 'subject-hr',
      description: 'HR-директора производств (противники внешних сервисов)',
      influence: 'medium',
      negative: true,
      goals: ['goal-mrr'],
      metrics: ['metric-conversion'],
    },
    {
      id: 'subject-it',
      description: 'ИТ-директора производств (требуют on-prem)',
      influence: 'medium',
      negative: true,
      goals: ['goal-mrr'],
      metrics: ['metric-nps'],
    },
  ],
  motivations: [
    {
      id: 'mo-tired',
      kind: 'pain',
      description: 'Смены срываются: некем закрывать пиковые дни',
      subject: 'subject-lead',
      influence: 'high',
    },
    {
      id: 'mo-control',
      kind: 'wish',
      description: 'Контроль замен без звонков и Excel',
      subject: 'subject-lead',
      influence: 'medium',
    },
    {
      id: 'mo-trust',
      kind: 'wish',
      description: 'Доверять решениям, рекомендованным теми, кто уже закрывает их смены',
      subject: 'subject-lead',
      influence: 'medium',
    },
    {
      id: 'mo-risk',
      kind: 'pain',
      description: 'Риск утечки персональных данных через внешний сервис',
      subject: 'subject-hr',
      influence: 'high',
    },
    {
      id: 'mo-onprem',
      kind: 'wish',
      description: 'Всё ПО — на своих серверах согласно политике ИБ',
      subject: 'subject-it',
      influence: 'medium',
    },
  ],
  hypotheses: [
    {
      id: 'hyp-live-demo',
      target: 'mo-tired',
      metrics: ['metric-conversion', 'metric-churn'],
      influence: 'high',
      cost: 'medium',
      status: 'to-verify',
      if: 'показать начальникам смен живую демо-площадку на реальных сменах',
      then: 'они сами начнут переводить свои производства в сервис',
      because: 'устали от срывов смен и ручного контроля замен',
      so: 'конверсия триал → платный вырастет без роста оттока',
    },
    {
      id: 'hyp-dpa',
      target: 'mo-risk',
      metrics: ['metric-conversion'],
      influence: 'medium',
      cost: 'low',
      status: 'to-verify',
      if: 'предложить HR-директорам шаблон договора обработки персональных данных',
      then: 'они снимут возражение об утечке данных',
      because: 'главный страх — персональные данные работников',
      so: 'сделки не будут срываться на юридической проверке',
    },
    {
      id: 'hyp-onprem',
      target: 'mo-onprem',
      metrics: ['metric-nps'],
      influence: 'medium',
      cost: 'high',
      status: 'draft',
      if: 'выпустить on-prem инсталляцию для крупных производств',
      then: 'ИТ-директора перестанут блокировать внедрение',
      because: 'их политика требует размещать всё на своих серверах',
      so: 'NPS крупных клиентов вырастет',
    },
    {
      id: 'hyp-partners',
      target: 'mo-trust',
      metrics: ['metric-share'],
      influence: 'low',
      cost: 'medium',
      status: 'draft',
      if: 'запустить партнёрскую программу с кадровыми агентствами',
      then: 'начальники смен узнают о сервисе от проверенных партнёров',
      because: 'доверяют решениям, рекомендованным теми, кто уже закрывает их смены',
      so: 'доля рынка начнёт расти',
    },
  ],
  tasks: [
    {
      id: 'task-demo-script',
      status: 'in-progress',
      group: 'Продукт',
      hypothesis: 'hyp-live-demo',
      description: 'Собрать сценарий демо на смене партнёра',
      owner: 'Аня',
      due: '2026-12-05',
    },
    {
      id: 'task-demo-funnel',
      group: 'Продукт',
      hypothesis: 'hyp-live-demo',
      description: 'Настроить воронку триал → платный в аналитике',
      owner: 'Илья',
      due: '2026-12-12',
    },
    {
      id: 'task-sandbox-mvp',
      group: 'Продукт',
      hypothesis: 'hyp-live-demo',
      description: 'Запустить песочницу как отдельный продукт',
      owner: 'Стас',
      due: '2027-03-01',
      childMapId: 'demo-smennsy-level2',
    },
    {
      id: 'task-dpa-template',
      status: 'in-progress',
      group: 'Юридическое',
      hypothesis: 'hyp-dpa',
      description: 'Подготовить шаблон DPA с юристами',
      owner: 'Мария',
      due: '2026-12-20',
    },
    {
      id: 'task-onprem-pilot',
      status: 'done',
      group: 'Внедрение',
      hypothesis: 'hyp-onprem',
      description: 'Провести on-prem пилот на одном производстве',
      owner: 'Дима',
      due: '2027-02-15',
    },
    {
      id: 'task-partner-deck',
      group: 'Партнёрства',
      hypothesis: 'hyp-partners',
      description: 'Собрать предложение для кадровых агентств',
      owner: 'Аня',
      due: '2027-01-15',
    },
  ],
  blockers: [
    {
      id: 'blocker-analytics',
      blocks: 'task-demo-funnel',
      reason: 'Нет доступа к событиям продукта',
      action: 'Выделить разработчика на интеграцию событий',
      owner: 'Илья',
      due: '2026-11-28',
    },
  ],
};

const SMENNSY_LEVEL2_MAP: HypothesisMap = {
  schemaVersion: 1,
  meta: {
    title: 'Демо: «Смены.Про» — песочница (карта уровнем ниже)',
    horizon: '2027 год',
    version: 1,
    date: '2026-11-16',
  },
  goal: {
    id: 'goal-sandbox',
    description: 'Вывести песочницу на самостоятельную выручку',
    metrics: [
      {
        id: 'metric-users',
        description: 'Платящие пользователи песочницы',
        current: '0',
        target: '50',
      },
    ],
  },
  subjects: [
    {
      id: 'subject-hr-smb',
      description: 'HR малых производств без отдельного ИТ-штат',
      influence: 'high',
    },
  ],
  hypotheses: [
    {
      id: 'hyp-free-start',
      target: 'subject-hr-smb',
      metrics: ['metric-users'],
      influence: 'high',
      cost: 'low',
      status: 'to-verify',
      if: 'дать бесплатный старт с оплатой по факту закрытых смен',
      then: 'HR подключат свои производства без согласования бюджета',
      because: 'не готовы платить вперёд за незнакомый сервис',
      so: 'платящие пользователи песочницы вырастут до 50',
    },
  ],
  tasks: [
    {
      id: 'task-free-tier',
      hypothesis: 'hyp-free-start',
      description: 'Сделать бесплатный тариф с лимитом смен',
      owner: 'Стас',
      due: '2027-01-20',
    },
    {
      id: 'task-onboarding',
      hypothesis: 'hyp-free-start',
      description: 'Упростить онбординг до одного экрана',
      owner: 'Лена',
      due: '2027-02-01',
    },
  ],
  blockers: [],
};

/** Несколько несвязанных целей — учебные примеры скилла hypothesis-mapping
 *  (references/examples.md №4, №5, №6), дословно: субъектный контур (текучесть)
 *  и два бессубъектных контура (дата-центр, автоматизация заказов). */
const MULTI_GOALS_MAP: HypothesisMap = {
  schemaVersion: 1,
  meta: {
    title: 'Демо: Несколько несвязанных целей (учебные примеры скилла)',
    version: 1,
    date: '2026-11-16',
  },
  goal: {
    id: 'goal-turnover',
    description: 'Снизить добровольную текучесть специалистов первого года работы',
    metrics: [
      {
        id: 'metric-turnover',
        description: 'Добровольная текучесть специалистов первого года',
        current: '18% в год',
        target: '12% в год',
      },
      {
        id: 'metric-hr-costs',
        description: 'Затраты на персонал',
        current: 'в установленном диапазоне',
        target: 'в том же диапазоне',
        balancing: true,
      },
    ],
  },
  goals: [
    {
      id: 'goal-dc',
      description: 'Снизить энергопотребление дата-центра без ухудшения доступности',
      metrics: [
        {
          id: 'metric-energy',
          description: 'Энергопотребление',
          current: 'базовый уровень',
          target: '−10%',
        },
        {
          id: 'metric-availability',
          description: 'Доступность',
          current: '99,99%',
          target: 'не ниже 99,99%',
          balancing: true,
        },
      ],
    },
    {
      id: 'goal-margin',
      description: 'Увеличить маржу обработки заказов при сохранении качества обслуживания',
      metrics: [
        {
          id: 'metric-margin',
          description: 'Маржа обработки заказов',
          current: 'ниже желаемой',
          target: 'желаемое значение',
        },
        {
          id: 'metric-quality',
          description: 'Качество обслуживания',
          current: 'целевой уровень',
          target: 'не ниже целевого',
          balancing: true,
        },
      ],
    },
  ],
  subjects: [
    {
      id: 'subject-junior',
      description: 'Специалисты первого года работы',
      influence: 'high',
      goals: ['goal-turnover'],
      pains: [
        'Поздно понимают критерии профессионального роста',
        'Считают решения о повышении непрозрачными',
      ],
    },
  ],
  hypotheses: [
    {
      id: 'hyp-growth',
      target: 'subject-junior',
      metrics: ['metric-turnover', 'metric-hr-costs'],
      influence: 'high',
      cost: 'medium',
      status: 'draft',
      if: 'сделать критерии профессионального роста наблюдаемыми и регулярно обсуждать прогресс без привязки к личным отношениям с руководителем',
      then: 'специалисты первого года будут раньше видеть реалистичный путь роста и реже искать новую работу из-за ощущения тупика',
      because: 'для них важны предсказуемость развития и ощущение справедливой оценки',
      so: 'добровольная текучесть этой группы снизится с 18% до 12% в год при сохранении затрат на персонал в установленном диапазоне',
    },
    {
      id: 'hyp-freecooling',
      target: 'goal-dc',
      metrics: ['metric-energy', 'metric-availability'],
      influence: 'medium',
      cost: 'low',
      status: 'draft',
      if: 'увеличить долю свободного охлаждения в допустимом температурном диапазоне',
      then: 'компрессоры будут работать меньше часов',
      because: 'наружный воздух сможет отводить требуемое количество тепла без работы компрессорного контура',
      so: 'энергопотребление снизится на 10%, а доступность останется не ниже 99,99%',
    },
    {
      id: 'hyp-autocheck',
      target: 'goal-margin',
      metrics: ['metric-margin', 'metric-quality'],
      influence: 'medium',
      cost: 'medium',
      status: 'draft',
      if: 'встроить автоматическую проверку полноты и непротиворечивости данных до подтверждения заказа',
      then: 'доля заказов с ошибками ввода снизится',
      because: 'алгоритм выявит пропуски и противоречия до перехода заказа на следующий этап',
      so: 'затраты на исправление ошибок снизятся, а маржа вырастет до желаемого значения при сохранении целевого уровня качества',
    },
  ],
  tasks: [
    {
      id: 'task-check-motivation',
      hypothesis: 'hyp-growth',
      description: 'Проверить данные о мотивации и причинную связь до принятия ставки',
    },
  ],
  blockers: [],
};

/** Метрики цели на отдельном уровне — учебный пример личной стратегии из
 *  базы знаний (metricdesign.md): субъективная шкала, объективная метрика
 *  и балансирующая граница вынесены карточками справа от цели. */
const METRICS_LEVEL_MAP: HypothesisMap = {
  schemaVersion: 1,
  meta: {
    title: 'Демо: Метрики цели на отдельном уровне (учебный пример базы знаний)',
    horizon: 'восемь недель',
    version: 1,
    date: '2026-11-16',
  },
  goal: {
    id: 'goal-freedom',
    description: 'Увеличить удовлетворённость свободой распоряжаться своим временем',
    metrics: [],
  },
  metrics: [
    {
      id: 'metric-fs-scale',
      description: 'Удовлетворённость свободой времени (моя шкала 1–10)',
      current: '4',
      target: '7',
      goalRef: 'goal-freedom',
      influence: 'high',
    },
    {
      id: 'metric-fs-evenings',
      description: 'Вечера в неделю с ≥1 свободным часом после обязательств',
      current: '0',
      target: '2',
      goalRef: 'goal-freedom',
      influence: 'medium',
    },
    {
      id: 'metric-fs-sleep',
      description: 'Сон (балансирующая граница)',
      current: '—',
      target: '≥ 7 часов/сутки',
      balancing: true,
      goalRef: 'goal-freedom',
      influence: 'medium',
    },
  ],
  subjects: [
    {
      id: 'subject-me-evenings',
      description: 'Я в будние вечера',
      influence: 'high',
      wishes: [
        'Самостоятельно распоряжаться частью своей жизни, не ждать внезапного свободного окна',
      ],
      metrics: ['metric-fs-scale', 'metric-fs-evenings'],
    },
  ],
  hypotheses: [
    {
      id: 'hyp-predictability',
      target: 'subject-me-evenings',
      metrics: ['metric-fs-scale', 'metric-fs-evenings', 'metric-fs-sleep'],
      influence: 'medium',
      cost: 'low',
      status: 'to-verify',
      if: 'повысить предсказуемость доступного мне свободного времени',
      then: 'я буду чаще выбирать занятия по собственному желанию',
      because: 'для меня важно самостоятельно распоряжаться частью своей жизни и не ждать внезапного свободного окна',
      so: 'удовлетворённость свободой времени вырастет с 4 до 7 по моей шкале',
    },
  ],
  tasks: [
    {
      id: 'task-lower-map',
      hypothesis: 'hyp-predictability',
      description: 'Построить нижнюю карту с целью обеспечить предсказуемые свободные периоды',
    },
    {
      id: 'task-weekly-score',
      hypothesis: 'hyp-predictability',
      description:
        'Оценивать удовлетворённость раз в неделю; первое решение о продолжении — через 8 недель',
    },
  ],
  blockers: [],
};

/** Топология «иерархия целей» (topology.md №4): цель — связка из нескольких
 *  элементов; корень («цель на 10 лет») левее, под-цели («на 3 года») —
 *  правее, стратегия строится от под-целей. Стрелка под-цель → родитель. */
const GOAL_HIERARCHY_MAP: HypothesisMap = {
  schemaVersion: 1,
  meta: {
    title: 'Демо: Иерархия целей (10 лет → 3 года)',
    version: 1,
    date: '2026-11-17',
  },
  goal: {
    id: 'goal-10y',
    description: 'Через 10 лет: платформа — стандарт подготовки рабочих профессий в стране',
    metrics: [
      {
        id: 'metric-employed',
        description: 'Доля выпускников, трудоустроенных по профессии',
        current: '41%',
        target: '70%',
      },
    ],
  },
  goals: [
    {
      id: 'goal-3y-product',
      description: 'Через 3 года: учебный продукт окупает себя без грантов',
      parent: 'goal-10y',
      influence: 'high',
      metrics: [
        {
          id: 'metric-margin',
          description: 'Маржинальность продукта',
          current: '−18%',
          target: '+15%',
        },
      ],
    },
    {
      id: 'goal-3y-network',
      description: 'Через 3 года: сеть колледжей-партнёров покрывает 20 регионов',
      parent: 'goal-10y',
      influence: 'medium',
      metrics: [],
    },
  ],
  subjects: [
    {
      id: 'subject-student',
      description: 'Студент колледжа 17–20 лет, выбирающий между подработкой и учёбой',
      influence: 'high',
      pains: ['Боится остаться без денег во время учёбы'],
      wishes: ['Хочет работать по профессии уже с первого курса'],
      goals: ['goal-3y-product'],
    },
    {
      id: 'subject-dean',
      description: 'Директор колледжа, отвечающий за набор студентов',
      influence: 'medium',
      pains: ['Боится оттока абитуриентов к курсам-конкурентам'],
      wishes: [],
      goals: ['goal-3y-network'],
    },
  ],
  hypotheses: [
    {
      id: 'hyp-dual',
      target: 'subject-student',
      metrics: ['metric-margin'],
      influence: 'high',
      cost: 'medium',
      status: 'to-verify',
      if: 'Если открыть дуальный формат «дни в колледже + дни на предприятии» с оплачиваемой практикой,',
      then: 'то студент остаётся на учёбе и приводит друзей на свой поток,',
      because: 'потому что ему нужны деньги и практика по профессии с первого курса,',
      so: 'тогда маржинальность продукта растёт за счёт софинансирования предприятиями.',
    },
    {
      id: 'hyp-partner',
      target: 'subject-dean',
      metrics: [],
      influence: 'medium',
      cost: 'low',
      status: 'draft',
      if: 'Если отдать колледжу готовую программу и методику за долю от набора,',
      then: 'то директор запускает набор без собственных разработок,',
      because: 'боится оттока абитуриентов к конкурентам и хочет быстрый результат,',
      so: 'тогда сеть растёт без наших капитальных затрат.',
    },
  ],
  tasks: [
    {
      id: 'task-dual-pilot',
      hypothesis: 'hyp-dual',
      description: 'Соглашения с 3 предприятиями о оплачиваемых местах практики',
      owner: 'Продукт',
    },
    {
      id: 'task-partner-pilot',
      hypothesis: 'hyp-partner',
      description: 'Пилот с двумя колледжами по готовой программе',
      owner: 'Партнёрства',
    },
  ],
  blockers: [],
};

/** Топология «группировка элементов» (topology.md №10) по схеме из базы
 *  знаний: группа из трёх субъектов, верхняя гипотеза воздействует на всю
 *  группу (одна стрелка в рамку), нижняя — на конкретного субъекта. */
const ELEMENT_GROUPS_MAP: HypothesisMap = {
  schemaVersion: 1,
  meta: {
    title: 'Демо: Группировка элементов (группа субъектов)',
    version: 1,
    date: '2026-11-17',
  },
  goal: {
    id: 'goal-nps',
    description: 'Клиенты рекомендуют банк друзьям и семье',
    metrics: [
      {
        id: 'metric-nps',
        description: 'NPS розничного блока',
        current: '17',
        target: '40',
      },
    ],
  },
  subjects: [
    {
      id: 'subject-vip-senior',
      description: 'Вип-клиент предпенсионного возраста',
      influence: 'high',
      pains: ['Боится потерять накопления из-за инфляции'],
    },
    {
      id: 'subject-vip-heir',
      description: 'Наследник семейного капитала',
      influence: 'medium',
      wishes: ['Хочет понимать, куда инвестирует семья'],
    },
    {
      id: 'subject-vip-founder',
      description: 'Основатель бизнеса, клиент private banking',
      influence: 'high',
      wishes: ['Хочет персональный сервис без очередей'],
    },
    {
      id: 'subject-smb',
      description: 'ИП, ведущий счёт в розничном отделении',
      influence: 'low',
      pains: ['Тяжело платить контрагентам из чужого банка'],
    },
  ],
  hypotheses: [
    {
      id: 'hyp-vip-all',
      target: 'grp-vip',
      metrics: ['metric-nps'],
      influence: 'high',
      cost: 'medium',
      status: 'to-verify',
      if: 'Если ввести персональные встречи с клиентским директором для всего премиум-сегмента,',
      then: 'ВИП-клиенты начинают рекомендовать банк своему кругу,',
      because: 'их статус подчёркнут сервисом, о котором есть что рассказать,',
      so: 'тогда NPS розничного блока растёт.',
    },
    {
      id: 'hyp-vip-heir',
      target: 'subject-vip-heir',
      metrics: ['metric-nps'],
      influence: 'medium',
      cost: 'low',
      status: 'draft',
      if: 'Если выпустить семейный отчёт о структуре капитала простым языком,',
      then: 'наследники разбираются в активах и остаются в банке,',
      because: 'сегодня им непонятно, куда инвестирует семья, и это отталкивает,',
      so: 'тогда их рекомендации прибавляют к NPS.',
    },
  ],
  groups: [
    {
      id: 'grp-vip',
      description: 'Премиум-сегмент',
      members: ['subject-vip-senior', 'subject-vip-heir', 'subject-vip-founder'],
    },
  ],
  tasks: [
    {
      id: 'task-pa-meetings',
      hypothesis: 'hyp-vip-all',
      description: 'Пилот персональных встреч в 3 отделениях',
      owner: 'Премиум',
    },
    {
      id: 'task-family-report',
      hypothesis: 'hyp-vip-heir',
      description: 'Макет семейного отчёта и тест с 5 клиентами',
      owner: 'Продукт',
    },
  ],
  blockers: [],
};

/** Демо-карты первого запуска; основная — «Гончар» (пример из базы знаний). */
export const DEMO_MAPS: Array<{ id: string; map: HypothesisMap }> = [
  { id: 'demo-gonchar', map: GONCHAR_MAP },
  { id: 'demo-smennsy-pro', map: SMENNSY_MAP },
  { id: 'demo-smennsy-level2', map: SMENNSY_LEVEL2_MAP },
  { id: 'demo-multi-goals', map: MULTI_GOALS_MAP },
  { id: 'demo-metrics-level', map: METRICS_LEVEL_MAP },
  { id: 'demo-goal-hierarchy', map: GOAL_HIERARCHY_MAP },
  { id: 'demo-element-groups', map: ELEMENT_GROUPS_MAP },
];
