import {
  Activity,
  Bell,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Database,
  Dices,
  Download,
  FileCheck2,
  FlaskConical,
  GitBranch,
  Hash,
  History,
  HelpCircle,
  ListChecks,
  LayoutDashboard,
  Moon,
  Network,
  PlayCircle,
  Plus,
  Radar,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Shuffle,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildInvestigationHash,
  mergeEvidenceEvents,
  recoverInvestigationLocation,
  saveInvestigationContext,
  transitionInvestigation,
} from "./investigation.mjs";
import type { EvidenceEvent, EvidenceFocus, InvestigationContext, InvestigationStatus } from "./investigation.mjs";
import {
  calculateCreateSampleAssessment,
  canDeleteExperiment,
  clearCreateDraft,
  createDraftFromExperimentRecord,
  createShortSeedSuffix,
  createDefaultDraft,
  createHash as createExperimentHash,
  getExperimentStatusAction,
  getExperimentStatusActions,
  isValidCustomSeed,
  loadCreateDraft,
  loadCreatedRecords,
  isSeedGenerationCurrent,
  readCreateStep,
  rankCandidateResults,
  saveCreateDraft,
  saveCreatedRecords,
  validateCreateStep,
} from "./create-experiment.mjs";
import type { CreateExperimentDraft, CreateStep, GeneratedSeedConfig } from "./create-experiment.mjs";
import { getFocusTrapTarget, popDrawer, pushDrawer } from "./drawer.mjs";
import type { DrawerName } from "./drawer.mjs";
import { paginate } from "./pagination.mjs";
import {
  canManageRule,
  rankAttributionCandidates,
  transitionAlertRule,
  validateAlertRule,
} from "./monitoring.mjs";
import type { AlertRule, AttributionCandidate, RuleActor } from "./monitoring.mjs";
import { TEST_ACCOUNTS, appendFilterCondition, canAccess, createInitialDemoState, getAccount, loadDemoState, resolveHistoricalSnapshot, saveDemoState, validateFilterCondition, validateSampleSql } from "./demo-access.mjs";
import type { DemoAccount } from "./demo-access.mjs";

type Tab =
  | "create"
  | "evaluate"
  | "list"
  | "investigate"
  | "seed"
  | "check"
  | "lineage"
  | "rollout"
  | "seedHistory"
  | "metrics"
  | "access"
  | "myImports"
  | "importReview"
  | "governance"
  | "permission";
type RoleView = "user" | "admin";
type ExperimentStatus = "draft" | "pending" | "running" | "paused" | "ended";
type QualityStatus = "passed" | "warning" | "critical";
type SourceType = "平台接入" | "表格导入" | "手动补录";
type CheckTargetType = "当前实验" | "候选 seed" | "批量 seed";
type OrthogonalityMode = "当前运行实验" | "批量 seed";
type SeedInputMode = "manual" | "template" | "random";
type ImportIssueLevel = "通过" | "需确认" | "阻断";
type RelationshipType = "父实验" | "子实验" | "关联实验" | "互斥实验";
type ReviewDecision = "合并" | "覆盖" | "跳过" | "要求补充" | "确认入库";
type ExperimentStage = "实验前" | "分流阶段" | "上线前" | "运行中" | "追溯复盘";
type AlertSeverity = "info" | "warning" | "critical";
type MonitorView = "alerts" | "attribution" | "rules";
type CheckScopeMode = "全部运行实验" | "同业务域" | "同分流层" | "手动指定";
type PermissionRoleId = "admin" | "businessOwner" | "experimentOwner" | "analyst" | "viewer";
type LedgerFilters = {
  keyword: string;
  businessLine: string;
  sourcePlatformKeyword: string;
  status: string;
  owner: string;
};
type CreateSampleField = Exclude<keyof CreateExperimentDraft["sample"], "splitGroups">;
type InvestigationStartOptions = {
  alertId?: string;
  focus?: EvidenceFocus;
  entrySource?: InvestigationContext["entrySource"];
  timeRange?: InvestigationContext["timeRange"];
  tab?: Tab;
};

interface MetricConfig {
  metricType: string;
  baseline: number;
  mde: number;
  confidence: number;
  power: number;
  dailyTraffic: number;
}

interface SampleDefinition {
  domain: string;
  source: string;
  window: string;
  unit: string;
  filterCondition?: string;
  finalSql?: string;
}

interface ReviewSummary {
  conclusion: string;
  tags: string[];
  similarExperiments: string[];
  nextAction: string;
}

interface SamplePlan {
  id: string;
  businessLine: string;
  metricType: string;
  baseline: number;
  mde: number;
  confidence: number;
  power: number;
  groups: number;
  dailyTraffic: number;
  perGroup: number;
  total: number;
  days: number;
  feasibility: QualityStatus;
  advice: string;
}

interface TrafficSplitPlan {
  id: string;
  experimentId: string;
  seed: string;
  trafficLayer: string;
  splitRatio: string;
  sampleScope: string;
  unit: string;
  reuseRisk: QualityStatus;
  selectedReason: string;
}

interface ValidationChecklist {
  experimentId: string;
  refreshedAt: string;
  items: Array<{ name: string; status: QualityStatus; detail: string; evidence: string }>;
}

interface MonitorAlert {
  id: string;
  experimentId: string;
  type: string;
  severity: AlertSeverity;
  metric: string;
  evidence: string;
  suggestedAction: string;
  owner: string;
  updatedAt: string;
}

interface AlertRuleRecord extends AlertRule {
  category: string;
  scope: string;
  recipients: string[];
  lastHit: string;
}

interface AttributionCandidateRecord extends AttributionCandidate {
  name: string;
  rolloutChange: string;
  riskReason: string;
}

interface PermissionProfile {
  id: PermissionRoleId;
  name: string;
  description: string;
  modules: string[];
  actions: string[];
  visibility: string;
  responsibleOwner: string;
  backupOwner: string;
  ruleThresholdRange: string;
}

interface RolloutEvent {
  time: string;
  type: string;
  from: string;
  to: string;
  operator: string;
  reason: string;
  sourcePlatform: string;
}

interface CheckSnapshot {
  target: string;
  preAA: string;
  uniformity: string;
  orthogonality: string;
  sampleScope: string;
  updatedAt: string;
}

interface RelationshipRecord {
  id: string;
  sourceExperimentId: string;
  targetExperimentId: string;
  type: RelationshipType;
  scope: string;
  reason: string;
  updatedAt: string;
  risk: QualityStatus;
}

interface RelationshipChangeEvent {
  id: string;
  relationshipId: string;
  action: "建立" | "修改" | "解除";
  operator: string;
  time: string;
  reason: string;
  fieldDelta: string;
}

interface ImportIssue {
  row: number;
  experimentId: string;
  level: ImportIssueLevel;
  issue: string;
  decision: ReviewDecision;
}

interface ImportBatch {
  id: string;
  file: string;
  submitter: string;
  submittedAt: string;
  status: string;
  summary: string;
  nextAction: string;
  issues: ImportIssue[];
}

interface ExperimentRecord {
  id: string;
  name: string;
  businessLine: string;
  sourcePlatform: string;
  sourceType: SourceType;
  owner: string;
  relationship: string;
  parentExperiment: string;
  trafficLayer: string;
  userGroup: string;
  rollout: number;
  status: ExperimentStatus;
  quality: QualityStatus;
  startTime: string;
  lastUpdated: string;
  coreMetric: string;
  guardrailMetric: string;
  stageStatus: ExperimentStage;
  metricConfig: MetricConfig;
  sampleDefinition: SampleDefinition;
  reviewSummary: ReviewSummary;
  alertStatus: AlertSeverity;
  rolloutEvents: RolloutEvent[];
  sourceQuality: string;
  importBatchId: string;
  checkSnapshot: CheckSnapshot;
  auditEvents: Array<{ time: string; operator: string; action: string }>;
  createDraft?: CreateExperimentDraft;
}

const experiments: ExperimentRecord[] = [
  {
    id: "EXP-240610-001",
    name: "新版首购引导流程",
    businessLine: "增长",
    sourcePlatform: "增长实验平台",
    sourceType: "平台接入",
    owner: "赵晨",
    relationship: "父实验",
    parentExperiment: "-",
    trafficLayer: "onboarding_core",
    userGroup: "新用户",
    rollout: 60,
    status: "running",
    quality: "passed",
    startTime: "2026-06-10 10:00",
    lastUpdated: "2026-06-25 10:30",
    coreMetric: "首购转化率",
    guardrailMetric: "投诉率",
    stageStatus: "运行中",
    metricConfig: { metricType: "转化率", baseline: 8.2, mde: 0.35, confidence: 95, power: 80, dailyTraffic: 180000 },
    sampleDefinition: { domain: "增长", source: "历史 A/A", window: "近 14 天", unit: "用户" },
    reviewSummary: {
      conclusion: "父实验指标稳定，继续观察子实验对后续会员转化的影响。",
      tags: ["首购", "父实验", "稳定放量"],
      similarExperiments: ["EXP-230911-014", "EXP-231118-006"],
      nextAction: "复核 60% 放量后 7 天护栏指标。",
    },
    alertStatus: "info",
    rolloutEvents: [
      { time: "2026-06-10 10:00", type: "启动", from: "0%", to: "10%", operator: "赵晨", reason: "进入小流量观察", sourcePlatform: "增长实验平台" },
      { time: "2026-06-14 16:20", type: "放量", from: "10%", to: "30%", operator: "赵晨", reason: "核心指标稳定", sourcePlatform: "增长实验平台" },
      { time: "2026-06-20 09:40", type: "放量", from: "30%", to: "60%", operator: "李维", reason: "观察期通过", sourcePlatform: "增长实验平台" },
    ],
    sourceQuality: "平台自动同步，字段完整，最近一次同步成功",
    importBatchId: "-",
    checkSnapshot: { target: "当前实验", preAA: "p=0.6824 通过", uniformity: "偏差 0.17% 通过", orthogonality: "p=1.0000 通过", sampleScope: "增长 · 历史 A/A · 近 14 天 · 用户", updatedAt: "2026-06-25 10:30" },
    auditEvents: [
      { time: "2026-06-20 09:40", operator: "李维", action: "放量从 30% 调整到 60%" },
      { time: "2026-06-14 16:20", operator: "赵晨", action: "补充观察结论并继续放量" },
    ],
  },
  {
    id: "EXP-240611-017",
    name: "会员权益文案强化",
    businessLine: "会员",
    sourcePlatform: "运营表格导入",
    sourceType: "表格导入",
    owner: "陈露",
    relationship: "子实验",
    parentExperiment: "EXP-240610-001",
    trafficLayer: "member_copy",
    userGroup: "新会员候选",
    rollout: 20,
    status: "running",
    quality: "warning",
    startTime: "2026-06-11 14:00",
    lastUpdated: "2026-06-24 18:12",
    coreMetric: "会员开通率",
    guardrailMetric: "退订率",
    stageStatus: "运行中",
    metricConfig: { metricType: "转化率", baseline: 6.4, mde: 0.28, confidence: 95, power: 80, dailyTraffic: 96000 },
    sampleDefinition: { domain: "会员", source: "历史 A/A", window: "近 14 天", unit: "用户" },
    reviewSummary: {
      conclusion: "子实验存在正交性复核项，结论需要和父实验放量窗口一起解释。",
      tags: ["会员", "子实验", "待复核"],
      similarExperiments: ["EXP-231210-031", "EXP-240302-012"],
      nextAction: "先比对 06-17 至 06-20 父子实验样本重叠。",
    },
    alertStatus: "warning",
    rolloutEvents: [
      { time: "2026-06-11 14:00", type: "启动", from: "0%", to: "5%", operator: "陈露", reason: "子实验灰度", sourcePlatform: "运营表格导入" },
      { time: "2026-06-17 11:30", type: "放量", from: "5%", to: "20%", operator: "陈露", reason: "补充样本量", sourcePlatform: "运营表格导入" },
    ],
    sourceQuality: "表格导入，负责人已匹配，父实验关系需复核",
    importBatchId: "IMP-20260703-01",
    checkSnapshot: { target: "当前实验", preAA: "p=0.2146 通过", uniformity: "偏差 0.42% 通过", orthogonality: "p=0.0481 需复核", sampleScope: "会员 · 历史 A/A · 近 14 天 · 用户", updatedAt: "2026-06-24 18:12" },
    auditEvents: [
      { time: "2026-06-24 18:12", operator: "陈露", action: "补充父实验 EXP-240610-001" },
      { time: "2026-06-17 11:30", operator: "陈露", action: "放量从 5% 调整到 20%" },
    ],
  },
  {
    id: "EXP-240612-008",
    name: "推荐位排序策略",
    businessLine: "推荐",
    sourcePlatform: "算法实验系统",
    sourceType: "平台接入",
    owner: "周一帆",
    relationship: "互斥实验",
    parentExperiment: "-",
    trafficLayer: "rec_home",
    userGroup: "活跃用户",
    rollout: 0,
    status: "paused",
    quality: "critical",
    startTime: "2026-06-12 09:30",
    lastUpdated: "2026-06-23 09:00",
    coreMetric: "入口点击率",
    guardrailMetric: "停留时长",
    stageStatus: "上线前",
    metricConfig: { metricType: "点击率", baseline: 12.6, mde: 0.5, confidence: 95, power: 80, dailyTraffic: 140000 },
    sampleDefinition: { domain: "推荐", source: "当前分流日志", window: "近 7 天", unit: "用户" },
    reviewSummary: {
      conclusion: "推荐策略与搜索实验存在互斥风险，暂停后等待冲突校验结论。",
      tags: ["推荐", "互斥实验", "暂停"],
      similarExperiments: ["EXP-240108-006", "EXP-240421-017"],
      nextAction: "重新跑当前运行实验正交性和规则冲突检查。",
    },
    alertStatus: "critical",
    rolloutEvents: [
      { time: "2026-06-12 09:30", type: "启动", from: "0%", to: "10%", operator: "周一帆", reason: "算法策略小流量", sourcePlatform: "算法实验系统" },
      { time: "2026-06-18 21:10", type: "暂停", from: "10%", to: "0%", operator: "周一帆", reason: "疑似与搜索策略重叠", sourcePlatform: "算法实验系统" },
    ],
    sourceQuality: "平台接入，暂停原因完整，互斥关系待处理",
    importBatchId: "-",
    checkSnapshot: { target: "当前实验", preAA: "p=0.0312 需处理", uniformity: "偏差 1.26% 需处理", orthogonality: "p=0.0228 需处理", sampleScope: "推荐 · 当前分流日志 · 近 7 天 · 用户", updatedAt: "2026-06-23 09:00" },
    auditEvents: [
      { time: "2026-06-18 21:10", operator: "周一帆", action: "暂停实验并记录冲突风险" },
      { time: "2026-06-12 09:30", operator: "周一帆", action: "启动小流量验证" },
    ],
  },
  {
    id: "EXP-240615-022",
    name: "支付页优惠提醒",
    businessLine: "交易",
    sourcePlatform: "手动补录",
    sourceType: "手动补录",
    owner: "吴雅",
    relationship: "关联实验",
    parentExperiment: "EXP-240611-017",
    trafficLayer: "pay_coupon",
    userGroup: "支付页访问用户",
    rollout: 35,
    status: "running",
    quality: "warning",
    startTime: "2026-06-15 18:00",
    lastUpdated: "2026-06-22 17:25",
    coreMetric: "支付成功率",
    guardrailMetric: "优惠成本",
    stageStatus: "追溯复盘",
    metricConfig: { metricType: "转化率", baseline: 18.4, mde: 0.42, confidence: 95, power: 80, dailyTraffic: 76000 },
    sampleDefinition: { domain: "交易", source: "离线人群包", window: "近 14 天", unit: "订单" },
    reviewSummary: {
      conclusion: "手动补录记录可用于排查，但上线前校验和来源链接需要补齐。",
      tags: ["交易", "手动补录", "成本护栏"],
      similarExperiments: ["EXP-231025-019", "EXP-240301-004"],
      nextAction: "补齐源系统链接并重新提交导入审核。",
    },
    alertStatus: "warning",
    rolloutEvents: [
      { time: "2026-06-15 18:00", type: "启动", from: "0%", to: "10%", operator: "吴雅", reason: "补录历史记录", sourcePlatform: "手动补录" },
      { time: "2026-06-19 10:00", type: "放量", from: "10%", to: "35%", operator: "吴雅", reason: "业务侧确认继续观察", sourcePlatform: "手动补录" },
    ],
    sourceQuality: "手动补录，缺少源系统链接，校验记录待补齐",
    importBatchId: "IMP-20260703-01",
    checkSnapshot: { target: "当前实验", preAA: "p=0.0918 通过", uniformity: "偏差 0.88% 通过", orthogonality: "p=0.0610 观察", sampleScope: "交易 · 离线人群包 · 近 14 天 · 订单", updatedAt: "2026-06-22 17:25" },
    auditEvents: [
      { time: "2026-06-22 17:25", operator: "吴雅", action: "补录来源平台和优惠成本护栏指标" },
      { time: "2026-06-19 10:00", operator: "吴雅", action: "放量从 10% 调整到 35%" },
    ],
  },
  {
    id: "EXP-240618-006",
    name: "搜索无结果页改版",
    businessLine: "搜索",
    sourcePlatform: "搜索实验后台",
    sourceType: "平台接入",
    owner: "刘昕",
    relationship: "独立实验",
    parentExperiment: "-",
    trafficLayer: "search_empty",
    userGroup: "搜索无结果用户",
    rollout: 100,
    status: "ended",
    quality: "passed",
    startTime: "2026-06-18 12:20",
    lastUpdated: "2026-06-25 08:14",
    coreMetric: "二次搜索率",
    guardrailMetric: "退出率",
    stageStatus: "追溯复盘",
    metricConfig: { metricType: "转化率", baseline: 22.1, mde: 0.6, confidence: 95, power: 90, dailyTraffic: 120000 },
    sampleDefinition: { domain: "搜索", source: "当前分流日志", window: "近 30 天", unit: "会话" },
    reviewSummary: {
      conclusion: "实验已结束归档，指标和放量记录完整，可作为相似实验参考。",
      tags: ["搜索", "归档", "可复用"],
      similarExperiments: ["EXP-230807-028", "EXP-240116-011"],
      nextAction: "沉淀搜索无结果页策略复盘摘要。",
    },
    alertStatus: "info",
    rolloutEvents: [
      { time: "2026-06-18 12:20", type: "启动", from: "0%", to: "20%", operator: "刘昕", reason: "进入验证", sourcePlatform: "搜索实验后台" },
      { time: "2026-06-21 12:20", type: "放量", from: "20%", to: "100%", operator: "刘昕", reason: "完成放量", sourcePlatform: "搜索实验后台" },
      { time: "2026-06-24 20:00", type: "结束", from: "100%", to: "100%", operator: "刘昕", reason: "实验归档", sourcePlatform: "搜索实验后台" },
    ],
    sourceQuality: "平台自动同步，已结束归档，记录完整",
    importBatchId: "-",
    checkSnapshot: { target: "当前实验", preAA: "p=0.5440 通过", uniformity: "偏差 0.21% 通过", orthogonality: "p=0.7622 通过", sampleScope: "搜索 · 当前分流日志 · 近 30 天 · 会话", updatedAt: "2026-06-25 08:14" },
    auditEvents: [
      { time: "2026-06-24 20:00", operator: "刘昕", action: "结束实验并归档" },
      { time: "2026-06-21 12:20", operator: "刘昕", action: "放量到 100%" },
    ],
  },
];

const navGroups: Array<{
  title: string;
  role: RoleView | "all";
  items: Array<{ key: Tab; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }>;
}> = [
  {
    title: "首页",
    role: "all",
    items: [
      { key: "list", label: "首页", icon: ClipboardList },
    ],
  },
  {
    title: "指标与权限",
    role: "all",
    items: [
      { key: "metrics", label: "指标管理", icon: Calculator },
      { key: "access", label: "我的权限", icon: ShieldCheck },
    ],
  },
  {
    title: "运行中",
    role: "all",
    items: [
      { key: "investigate", label: "监控排查", icon: Radar },
    ],
  },
  {
    title: "实验管理",
    role: "all",
    items: [
      { key: "lineage", label: "父子实验", icon: Network },
      { key: "rollout", label: "放量历史", icon: Clock3 },
      { key: "seedHistory", label: "随机数放量历史", icon: Hash },
      { key: "myImports", label: "批量导入记录", icon: Upload },
    ],
  },
  {
    title: "管理后台",
    role: "admin",
    items: [
      { key: "importReview", label: "批量导入审核", icon: FileCheck2, adminOnly: true },
      { key: "governance", label: "数据治理", icon: Database, adminOnly: true },
      { key: "permission", label: "权限配置", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

const allTabs: Tab[] = ["create", ...navGroups.flatMap((group) => group.items.map((item) => item.key))];
const adminTabs = new Set<Tab>(["importReview", "governance", "permission"]);
const defaultLedgerFilters: LedgerFilters = {
  keyword: "",
  businessLine: "all",
  sourcePlatformKeyword: "",
  status: "all",
  owner: "",
};
const LEDGER_PAGE_SIZE = 10;
const stageTargets: Array<{ tab: Tab; label: string }> = [
  { tab: "evaluate", label: "实验前评估" },
  { tab: "seed", label: "分流方案" },
  { tab: "check", label: "上线前检查" },
  { tab: "investigate", label: "运行中监控排查" },
  { tab: "list", label: "追溯复盘" },
];
const stageByTab: Record<Tab, Tab> = {
  create: "create",
  evaluate: "evaluate",
  seed: "seed",
  seedHistory: "seed",
  check: "check",
  investigate: "investigate",
  list: "list",
  lineage: "list",
  rollout: "list",
  myImports: "list",
  importReview: "list",
  governance: "list",
  permission: "list",
  metrics: "list",
  access: "list",
};

function tabFromHash(hash = typeof window !== "undefined" ? window.location.hash : "") {
  const key = hash.replace(/^#/, "") as Tab;
  return allTabs.includes(key) ? key : null;
}

const statusText: Record<ExperimentStatus, string> = {
  draft: "草稿",
  pending: "待上线",
  running: "运行中",
  paused: "已暂停",
  ended: "已结束",
};

const qualityText: Record<QualityStatus, string> = {
  passed: "通过",
  warning: "待补齐",
  critical: "需处理",
};

const relationRecords: RelationshipRecord[] = [
  { id: "REL-001", sourceExperimentId: "EXP-240610-001", targetExperimentId: "EXP-240611-017", type: "父实验", scope: "onboarding_core / 新用户", reason: "会员权益文案强化只在首购引导流程新用户样本中解释", updatedAt: "2026-06-24 18:12", risk: "warning" },
  { id: "REL-002", sourceExperimentId: "EXP-240611-017", targetExperimentId: "EXP-240615-022", type: "关联实验", scope: "会员转化后支付页", reason: "会员权益文案可能影响后续支付页优惠提醒转化", updatedAt: "2026-06-22 17:25", risk: "warning" },
  { id: "REL-003", sourceExperimentId: "EXP-240612-008", targetExperimentId: "EXP-240618-006", type: "互斥实验", scope: "rec_home 与 search_empty 交叉用户", reason: "推荐策略和搜索兜底策略共享活跃用户池，暂停后待复核", updatedAt: "2026-06-23 09:00", risk: "critical" },
  { id: "REL-004", sourceExperimentId: "EXP-240618-006", targetExperimentId: "EXP-240610-001", type: "关联实验", scope: "新用户搜索路径", reason: "新用户首购流程中存在搜索无结果页路径，排查时需要串联", updatedAt: "2026-06-25 08:14", risk: "passed" },
];

const relationshipChangeEvents: RelationshipChangeEvent[] = [
  { id: "RCH-001", relationshipId: "REL-001", action: "建立", operator: "赵晨", time: "2026-06-11 13:40", reason: "会员权益文案需依赖首购引导链路", fieldDelta: "关系类型：父实验；影响范围：新用户" },
  { id: "RCH-002", relationshipId: "REL-001", action: "修改", operator: "陈露", time: "2026-06-24 18:12", reason: "补充样本重叠说明", fieldDelta: "影响范围：新增 onboarding_core / 新用户" },
  { id: "RCH-003", relationshipId: "REL-003", action: "建立", operator: "周一帆", time: "2026-06-18 21:10", reason: "发现推荐与搜索策略重叠", fieldDelta: "关系类型：互斥实验；风险：需处理" },
  { id: "RCH-004", relationshipId: "REL-002", action: "修改", operator: "吴雅", time: "2026-06-22 17:25", reason: "支付路径影响范围重新确认", fieldDelta: "影响范围：会员转化后支付页" },
];

function relationshipPlacementForFocus(record: RelationshipRecord, focusedExperimentId: string): { peerId: string; side: "upstream" | "downstream" } | null {
  if (record.sourceExperimentId !== focusedExperimentId && record.targetExperimentId !== focusedExperimentId) return null;
  const peerId = record.sourceExperimentId === focusedExperimentId ? record.targetExperimentId : record.sourceExperimentId;
  if (peerId === focusedExperimentId) return null;
  return {
    peerId,
    side: record.type === "互斥实验" || record.sourceExperimentId === focusedExperimentId ? "downstream" : "upstream",
  };
}

function getRolloutRiskReasons(events: RolloutEvent[], event: RolloutEvent): string[] {
  const reasons: string[] = [];
  if (!event.reason.trim()) reasons.push("原因缺失");
  const currentTime = Date.parse(event.time.replace(" ", "T"));
  const nearbyChanges = events.filter((candidate) => {
    // Rollout rows are enriched copies, so identity cannot reliably exclude the
    // current event. Exclude the same recorded change before counting neighbours.
    if (candidate.time === event.time
      && candidate.type === event.type
      && candidate.from === event.from
      && candidate.to === event.to
      && candidate.operator === event.operator) return false;
    const candidateTime = Date.parse(candidate.time.replace(" ", "T"));
    return Number.isFinite(candidateTime) && Math.abs(candidateTime - currentTime) <= 7 * 24 * 60 * 60 * 1000;
  });
  if (nearbyChanges.length) reasons.push(`7天内连续放量（相邻 ${nearbyChanges.length} 次）`);
  return reasons;
}

const reviewDecisions: ReviewDecision[] = ["合并", "覆盖", "跳过", "要求补充", "确认入库"];

const importBatches: ImportBatch[] = [
  {
    id: "IMP-20260703-01",
    file: "experiment_import_20260703.xlsx",
    submitter: "当前用户",
    submittedAt: "2026-07-03 10:30",
    status: "待管理员审核",
    summary: "通过 1 / 需确认 1 / 阻断 2",
    nextAction: "管理员需处理重复实验、父实验缺失和放量异常后确认入库",
    issues: [
      { row: 2, experimentId: "EXP-240701-009", level: "通过", issue: "字段完整，可直接导入", decision: "确认入库" },
      { row: 3, experimentId: "EXP-240701-010", level: "需确认", issue: "负责人缺失；来源平台命中运营表格导入", decision: "要求补充" },
      { row: 4, experimentId: "EXP-240611-017", level: "阻断", issue: "实验 ID 已存在，需要选择覆盖、合并或跳过", decision: "合并" },
      { row: 5, experimentId: "EXP-240701-011", level: "阻断", issue: "放量比例超过 100%；父实验不存在", decision: "跳过" },
    ],
  },
  {
    id: "IMP-20260702-03",
    file: "member_experiment_backfill.xlsx",
    submitter: "陈露",
    submittedAt: "2026-07-02 16:45",
    status: "需补充",
    summary: "通过 6 / 需确认 2 / 阻断 0",
    nextAction: "提交人补充来源平台别名和父实验说明",
    issues: [
      { row: 8, experimentId: "EXP-240628-021", level: "需确认", issue: "来源平台别名未命中生产登记名", decision: "要求补充" },
      { row: 9, experimentId: "EXP-240628-022", level: "需确认", issue: "父子关系原因为空", decision: "要求补充" },
    ],
  },
];

const samplePlans: SamplePlan[] = [
  {
    id: "SPL-240610-001",
    businessLine: "增长",
    metricType: "转化率",
    baseline: 8.2,
    mde: 0.35,
    confidence: 95,
    power: 80,
    groups: 2,
    dailyTraffic: 180000,
    perGroup: 132380,
    total: 264760,
    days: 2,
    feasibility: "passed",
    advice: "样本和周期可支持上线前评估，可直接带入 Seed 评估和上线前校验。",
  },
  {
    id: "SPL-240611-017",
    businessLine: "会员",
    metricType: "转化率",
    baseline: 6.4,
    mde: 0.18,
    confidence: 95,
    power: 80,
    groups: 3,
    dailyTraffic: 52000,
    perGroup: 505920,
    total: 1517760,
    days: 30,
    feasibility: "warning",
    advice: "周期偏长，建议扩大客群、降低分组数或提高 MDE 后再进入上线前检查。",
  },
];

const trafficSplitPlans: TrafficSplitPlan[] = [
  { id: "TSP-001", experimentId: "EXP-240610-001", seed: "onboarding_core:v1", trafficLayer: "onboarding_core", splitRatio: "50 / 50", sampleScope: "增长 · 历史 A/A · 近 14 天", unit: "用户", reuseRisk: "passed", selectedReason: "历史 A/A 与均匀性均稳定，当前层未命中互斥实验。" },
  { id: "TSP-002", experimentId: "EXP-240611-017", seed: "member-copy-v2", trafficLayer: "member_copy", splitRatio: "50 / 50", sampleScope: "会员 · 历史 A/A · 近 14 天", unit: "用户", reuseRisk: "warning", selectedReason: "与父实验窗口有交叉，选择前需要复跑正交性。" },
  { id: "TSP-003", experimentId: "EXP-240612-008", seed: "rec_home_guard", trafficLayer: "rec_home", splitRatio: "50 / 50", sampleScope: "推荐 · 当前分流日志 · 近 7 天", unit: "用户", reuseRisk: "critical", selectedReason: "命中互斥实验和样本重叠，暂不建议上线。" },
];

const validationChecklists: ValidationChecklist[] = [
  {
    experimentId: "EXP-240610-001",
    refreshedAt: "2026-06-25 10:30",
    items: [
      { name: "Pre-AA", status: "passed", detail: "历史 A/A 未见显著差异", evidence: "p=0.6824" },
      { name: "均匀性", status: "passed", detail: "分桶偏差 0.17%", evidence: "增长样本 · 用户" },
      { name: "正交性", status: "passed", detail: "当前运行实验未见相关", evidence: "p=1.0000" },
      { name: "规则冲突", status: "passed", detail: "未命中同层互斥实验", evidence: "onboarding_core" },
    ],
  },
  {
    experimentId: "EXP-240611-017",
    refreshedAt: "2026-06-24 18:12",
    items: [
      { name: "Pre-AA", status: "passed", detail: "历史 A/A 未见显著差异", evidence: "p=0.2146" },
      { name: "均匀性", status: "passed", detail: "分桶偏差 0.42%", evidence: "会员样本 · 用户" },
      { name: "正交性", status: "warning", detail: "与父实验样本窗口接近阈值", evidence: "p=0.0481" },
      { name: "规则冲突", status: "warning", detail: "父实验正在放量，需要联动解释", evidence: "EXP-240610-001" },
    ],
  },
  {
    experimentId: "EXP-240612-008",
    refreshedAt: "2026-06-23 09:00",
    items: [
      { name: "Pre-AA", status: "critical", detail: "历史 A/A 存在显著差异", evidence: "p=0.0312" },
      { name: "均匀性", status: "critical", detail: "分桶偏差超过 1%", evidence: "偏差 1.26%" },
      { name: "正交性", status: "critical", detail: "与搜索实验存在相关风险", evidence: "p=0.0228" },
      { name: "规则冲突", status: "critical", detail: "命中互斥实验，当前不建议放量", evidence: "EXP-240618-006" },
    ],
  },
];

const monitorAlerts: MonitorAlert[] = [
  { id: "ALT-001", experimentId: "EXP-240611-017", type: "倒挂定位", severity: "warning", metric: "会员开通率", evidence: "父实验 06-20 放量后，子实验核心指标连续 2 天低于对照组。", suggestedAction: "查看父子关系和放量窗口，复跑正交性检查。", owner: "陈露", updatedAt: "2026-06-24 18:12" },
  { id: "ALT-002", experimentId: "EXP-240612-008", type: "交叉实验影响", severity: "critical", metric: "入口点击率", evidence: "rec_home 与 search_empty 交叉用户池重叠，规则冲突检查未通过。", suggestedAction: "暂停放量，联系搜索实验负责人确认互斥策略。", owner: "周一帆", updatedAt: "2026-06-23 09:00" },
  { id: "ALT-003", experimentId: "EXP-240615-022", type: "样本比例异常", severity: "warning", metric: "优惠成本", evidence: "手动补录放量 10% -> 35%，来源链接缺失，成本护栏抬升。", suggestedAction: "补齐来源记录并在上线前检查中重新确认样本口径。", owner: "吴雅", updatedAt: "2026-06-22 17:25" },
];

const initialAlertRules: AlertRuleRecord[] = [
  {
    id: "RULE-001",
    name: "样本比例持续失衡",
    experimentId: "EXP-240610-001",
    owner: "赵晨",
    metric: "A/B 样本比例偏差",
    category: "样本",
    operator: ">",
    threshold: 1.5,
    consecutiveWindows: 2,
    severity: "critical",
    scope: "当前实验 · 全部分组",
    recipients: ["赵晨", "实验告警群"],
    status: "enabled",
    version: 4,
    lastHit: "2026-06-24 09:30",
    audit: [{ id: "AUD-R1", actor: "赵晨", action: "调整阈值", note: "1.0% 调整为 1.5%", occurredAt: "2026-06-20 17:15" }],
  },
  {
    id: "RULE-002",
    name: "成本护栏抬升",
    experimentId: "EXP-240615-022",
    owner: "吴雅",
    metric: "优惠成本变化率",
    category: "护栏",
    operator: ">",
    threshold: 8,
    consecutiveWindows: 1,
    severity: "warning",
    scope: "交易业务域 · 运行中实验",
    recipients: ["吴雅", "交易实验群"],
    status: "enabled",
    version: 2,
    lastHit: "2026-06-22 17:25",
    audit: [{ id: "AUD-R2", actor: "赵晨", action: "启用规则", note: "管理员按模板创建", occurredAt: "2026-06-18 11:20" }],
  },
  {
    id: "RULE-003",
    name: "核心指标连续倒挂",
    experimentId: "EXP-240611-017",
    owner: "陈露",
    metric: "会员开通率",
    category: "主指标",
    operator: "<",
    threshold: -3,
    consecutiveWindows: 2,
    severity: "warning",
    scope: "当前实验 · 对照组比较",
    recipients: ["陈露"],
    status: "disabled",
    version: 5,
    lastHit: "2026-06-24 18:12",
    audit: [{ id: "AUD-R3", actor: "陈露", action: "停用规则", note: "等待父实验放量窗口结束", occurredAt: "2026-06-25 09:10" }],
  },
];

const initialPermissionProfiles: PermissionProfile[] = [
  { id: "admin", name: "管理员", description: "维护角色、规则模板与审计策略", modules: ["全部模块"], actions: ["查看", "编辑", "审核", "授权"], visibility: "全部业务域与实验", responsibleOwner: "赵晨", backupOwner: "李维", ruleThresholdRange: "可维护模板上下限" },
  { id: "businessOwner", name: "业务负责人", description: "管理所属业务域的实验资产和负责人", modules: ["新增实验", "实验管理", "监控排查"], actions: ["查看", "编辑元数据", "指派负责人"], visibility: "所属业务域", responsibleOwner: "陈露", backupOwner: "吴雅", ruleThresholdRange: "模板范围内调整" },
  { id: "experimentOwner", name: "实验负责人", description: "维护自己负责实验并处理告警", modules: ["新增实验", "实验管理", "监控排查"], actions: ["查看", "编辑自己实验", "启停自己规则"], visibility: "负责与协作实验", responsibleOwner: "周一帆", backupOwner: "刘昕", ruleThresholdRange: "模板范围内调整" },
  { id: "analyst", name: "分析人员", description: "查看脱敏指标和归因证据", modules: ["实验管理", "监控排查"], actions: ["查看", "导出脱敏结果"], visibility: "授权业务域", responsibleOwner: "刘昕", backupOwner: "陈露", ruleThresholdRange: "只读" },
  { id: "viewer", name: "只读用户", description: "查看授权范围内的实验资产", modules: ["实验清单", "父子实验", "放量历史"], actions: ["查看"], visibility: "显式授权实验", responsibleOwner: "吴雅", backupOwner: "-", ruleThresholdRange: "只读" },
];

const investigationStatusText: Record<InvestigationStatus, string> = {
  idle: "未开始",
  investigating: "排查中",
  collaborating: "待协同",
  resolved: "已定位",
  closed: "已关闭",
};

const LOCAL_CASE_SEQUENCE_PREFIX = "experiment-asset-local-case-sequence-";
const localCaseSequenceFallback = new Map<string, number>();

function createLocalCaseId(now = new Date()) {
  const datePart = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const sequenceKey = `${LOCAL_CASE_SEQUENCE_PREFIX}${datePart}`;
  const fallbackSequence = localCaseSequenceFallback.get(datePart) ?? 0;
  let sequence = fallbackSequence + 1;

  try {
    if (typeof window !== "undefined") {
      const storedSequence = Number(window.sessionStorage.getItem(sequenceKey));
      const persistedSequence = Number.isSafeInteger(storedSequence) && storedSequence >= 0 ? storedSequence : 0;
      sequence = Math.max(fallbackSequence, persistedSequence) + 1;
      window.sessionStorage.setItem(sequenceKey, String(sequence));
    }
  } catch {
    sequence = fallbackSequence + 1;
  }

  localCaseSequenceFallback.set(datePart, sequence);
  return `CASE-${datePart}-${String(sequence).padStart(3, "0")}`;
}

function buildEvidenceTimeline(context: InvestigationContext | null): EvidenceEvent[] {
  if (!context) return [];
  const experiment = experiments.find((item) => item.id === context.experimentId);
  if (!experiment) return [];
  const severityByQuality: Record<QualityStatus, EvidenceEvent["severity"]> = {
    passed: "info",
    warning: "warning",
    critical: "critical",
  };
  const alertEvents = monitorAlerts
    .filter((alert) => alert.experimentId === experiment.id && (!context.alertId || alert.id === context.alertId))
    .map((alert) => ({
      id: `alert-${alert.id}`,
      experimentId: experiment.id,
      occurredAt: alert.updatedAt,
      type: "alert" as const,
      title: alert.type,
      summary: alert.evidence,
      sourcePlatform: experiment.sourcePlatform,
      operator: alert.owner,
      severity: alert.severity,
      requiresAction: alert.severity !== "info",
    }));
  const rolloutEvents = experiment.rolloutEvents.map((event, index) => ({
    id: `rollout-${experiment.id}-${index}`,
    experimentId: experiment.id,
    occurredAt: event.time,
    type: "rollout" as const,
    title: `${event.type} ${event.from} 至 ${event.to}`,
    summary: event.reason,
    sourcePlatform: event.sourcePlatform,
    operator: event.operator,
    severity: "info" as const,
    requiresAction: false,
  }));
  const relationshipEvents = relationRecords
    .filter((record) => record.sourceExperimentId === experiment.id || record.targetExperimentId === experiment.id)
    .map((record) => ({
      id: `relationship-${record.id}`,
      experimentId: experiment.id,
      occurredAt: record.updatedAt,
      type: "relationship" as const,
      title: `${record.type}关系变更`,
      summary: record.reason,
      sourcePlatform: experiment.sourcePlatform,
      operator: experiment.owner,
      severity: severityByQuality[record.risk],
      requiresAction: record.risk !== "passed",
    }));
  const checklist = validationChecklists.find((item) => item.experimentId === experiment.id);
  const validationEvents = checklist
    ? checklist.items.map((item, index) => ({
        id: `validation-${experiment.id}-${index}`,
        experimentId: experiment.id,
        occurredAt: checklist.refreshedAt,
        type: "validation" as const,
        title: `${item.name}校验`,
        summary: `${item.detail}（${item.evidence}）`,
        sourcePlatform: experiment.sourcePlatform,
        operator: experiment.owner,
        severity: severityByQuality[item.status],
        requiresAction: item.status !== "passed",
      }))
    : [];
  return mergeEvidenceEvents([...alertEvents, ...rolloutEvents, ...relationshipEvents, ...validationEvents]);
}

function enrichDirectInvestigationOwner(context: InvestigationContext | null) {
  if (!context || context.caseId || context.owner) return context;
  const experiment = experiments.find((item) => item.id === context.experimentId);
  return experiment ? { ...context, owner: experiment.owner } : context;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value)));
}

function getSampleFeasibility(days: number): { status: QualityStatus; label: string; advice: string } {
  if (days <= 14) {
    return { status: "passed", label: "可行性结论：可进入分流评估", advice: "样本量与周期可控，建议继续做 Seed 评估、Pre-AA 和规则冲突检查。" };
  }
  if (days <= 30) {
    return { status: "warning", label: "可行性结论：需要调整方案", advice: "周期偏长，建议扩大客群、减少分组数、调高 MDE 或延长观察窗口。" };
  }
  return { status: "critical", label: "可行性结论：暂不建议直接 A/B", advice: "样本不足会导致结论波动，建议改用准实验、前后对比或先做更大样本池准备。" };
}

function hashSeed(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoreSeed(seed: string) {
  const base = hashSeed(seed);
  const preAa = 76 + (base % 1900) / 100;
  const uniformity = 74 + ((base >>> 7) % 2100) / 100;
  const orthogonality = 72 + ((base >>> 13) % 2300) / 100;
  const conflictRisk = ((base >>> 19) % 1600) / 100;
  const score = Math.round(preAa * 0.34 + uniformity * 0.32 + orthogonality * 0.26 - conflictRisk * 0.4);
  return {
    seed,
    preAa,
    uniformity,
    orthogonality,
    conflictRisk,
    score,
    status: score >= 88 ? "推荐" : score >= 82 ? "可用" : "谨慎",
  };
}

const importRows = [
  { row: 2, experimentId: "EXP-240701-009", name: "搜索召回兜底策略", owner: "刘昕", platform: "搜索实验后台", rollout: 10, parent: "-", level: "通过" as ImportIssueLevel, issue: "字段完整，可直接导入" },
  { row: 3, experimentId: "EXP-240701-010", name: "会员权益入口重排", owner: "", platform: "运营表格", rollout: 30, parent: "EXP-240610-001", level: "需确认" as ImportIssueLevel, issue: "负责人缺失；来源平台命中运营表格导入" },
  { row: 4, experimentId: "EXP-240611-017", name: "会员权益文案强化", owner: "陈露", platform: "运营表格导入", rollout: 20, parent: "EXP-240610-001", level: "阻断" as ImportIssueLevel, issue: "实验 ID 已存在，需要选择覆盖、合并或跳过" },
  { row: 5, experimentId: "EXP-240701-011", name: "支付页补贴提醒", owner: "吴雅", platform: "手动补录", rollout: 135, parent: "EXP-404", level: "阻断" as ImportIssueLevel, issue: "放量比例超过 100%；父实验不存在" },
];

function runImportPrecheck(rows = importRows) {
  return rows.map((row) => {
    const issues = [
      row.owner ? "" : "负责人缺失",
      experiments.some((item) => item.id === row.experimentId) ? "实验 ID 已存在" : "",
      row.rollout < 0 || row.rollout > 100 ? "放量比例异常" : "",
      row.parent !== "-" && !experiments.some((item) => item.id === row.parent) ? "父实验不存在" : "",
      row.platform.includes("运营表格") && row.platform !== "运营表格导入" ? "来源平台需确认" : "",
    ].filter(Boolean);
    const level: ImportIssueLevel = issues.some((item) => ["实验 ID 已存在", "放量比例异常", "父实验不存在"].includes(item)) ? "阻断" : issues.length ? "需确认" : "通过";
    return { ...row, level, issue: issues.length ? issues.join("；") : "字段完整，可直接导入" };
  });
}

function parseTemplateVars(text: string) {
  return Object.fromEntries(
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...value] = line.split("=");
        return [key.trim(), value.join("=").trim()];
      }),
  );
}

function buildSeedCandidates(mode: SeedInputMode, manualText: string, template: string, varsText: string, randomBase: string, count: number) {
  let seeds: string[] = [];
  if (mode === "manual") {
    seeds = manualText
      .split(/\n|,|;|\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (mode === "template") {
    const vars = parseTemplateVars(varsText);
    const compiled = template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] || key);
    seeds = Array.from({ length: Math.max(1, count) }, (_, index) => `${compiled}:v${index + 1}`);
  } else {
    seeds = Array.from({ length: Math.max(1, count) }, (_, index) => {
      const base = hashSeed(`${randomBase}-${Date.UTC(2026, 6, 3)}-${index}`);
      return `${randomBase}:${base.toString(36)}:${(base >>> 8).toString(16)}`;
    });
  }
  return seeds.slice(0, Math.max(1, count)).map(scoreSeed);
}

function buildCreateSeedCandidates(generated: GeneratedSeedConfig) {
  const base = generated.template.trim() || `${generated.domain}_${generated.sampleUnit}`.toLowerCase();
  const suffixes = new Set<string>();
  const seeds = Array.from({ length: Math.max(1, generated.candidateCount) }, (_, index) => {
    let collision = 0;
    let suffix = createShortSeedSuffix(generated.key, index);
    while (suffixes.has(suffix)) {
      collision += 1;
      suffix = createShortSeedSuffix(`${generated.key}:${collision}`, index);
    }
    suffixes.add(suffix);
    return `${base}_${suffix}`;
  });
  return rankCandidateResults(seeds.map(createSeedCandidate));
}

function createSeedCandidate(seed: string) {
  const item = scoreSeed(seed);
  return { ...item, quality: item.score >= 82 ? "passed" as const : item.score >= 78 ? "warning" as const : "critical" as const };
}

function erf(x: number) {
  const sign = x >= 0 ? 1 : -1;
  const absolute = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absolute);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-absolute * absolute));
  return sign * y;
}

function normalCdf(x: number) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function calculatePreAA(controlRate: number, variantRate: number, sampleSize: number) {
  const p1 = controlRate / 100;
  const p2 = variantRate / 100;
  const pooled = (p1 + p2) / 2;
  const se = Math.sqrt(Math.max(0.0000001, (2 * pooled * (1 - pooled)) / sampleSize));
  const z = Math.abs(p1 - p2) / se;
  const pValue = Math.max(0.0001, 2 * (1 - normalCdf(z)));
  return { z, pValue, passed: pValue >= 0.05 };
}

function calculateUniformity(a: number, b: number, split: number) {
  const total = Math.max(1, a + b);
  const expectedA = total * (split / 100);
  const expectedB = total - expectedA;
  const chi = (a - expectedA) ** 2 / expectedA + (b - expectedB) ** 2 / expectedB;
  const pValue = Math.exp(-0.5 * chi);
  const deviation = Math.abs(a / total - split / 100) * 100;
  return { chi, pValue, deviation, passed: pValue >= 0.05 && deviation <= 1 };
}

function calculateOrthogonality(matrix: [number, number, number, number]) {
  const [a, b, c, d] = matrix;
  const total = Math.max(1, a + b + c + d);
  const row1 = a + b;
  const row2 = c + d;
  const col1 = a + c;
  const col2 = b + d;
  const expected = [(row1 * col1) / total, (row1 * col2) / total, (row2 * col1) / total, (row2 * col2) / total];
  const observed = [a, b, c, d];
  const chi = observed.reduce((sum, item, index) => sum + (item - expected[index]) ** 2 / Math.max(1, expected[index]), 0);
  const pValue = Math.exp(-0.5 * chi);
  return { chi, pValue, passed: pValue >= 0.05 };
}

function App() {
  const [roleView, setRoleView] = useState<RoleView>("user");
  const [demoState, setDemoState] = useState(() => loadDemoState());
  const activeAccount = getAccount(demoState.sessionAccountId) as DemoAccount | null;
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const recovered = recoverInvestigationLocation(typeof window === "undefined" ? "" : window.location.hash);
    return !adminTabs.has(recovered.tab as Tab) ? recovered.tab as Tab : "list";
  });
  const [investigationContext, setInvestigationContext] = useState<InvestigationContext | null>(() => {
    const recovered = recoverInvestigationLocation(typeof window === "undefined" ? "" : window.location.hash);
    return enrichDirectInvestigationOwner(recovered.context);
  });
  const [evidenceTimeline, setEvidenceTimeline] = useState<EvidenceEvent[]>(() => {
    const recovered = recoverInvestigationLocation(typeof window === "undefined" ? "" : window.location.hash);
    return buildEvidenceTimeline(enrichDirectInvestigationOwner(recovered.context));
  });
  const [selected, setSelected] = useState<ExperimentRecord | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [globalSearchKeyword, setGlobalSearchKeyword] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [filters, setFilters] = useState<LedgerFilters>(defaultLedgerFilters);
  const [filterDraft, setFilterDraft] = useState<LedgerFilters>(defaultLedgerFilters);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageInput, setLedgerPageInput] = useState("1");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [createExperimentOpen, setCreateExperimentOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateExperimentDraft>(() => loadCreateDraft() ?? createDefaultDraft());
  const [createStep, setCreateStep] = useState<CreateStep>(() => readCreateStep(typeof window === "undefined" ? "" : window.location.hash));
  const [createSampleExpanded, setCreateSampleExpanded] = useState(false);
  const [createdExperiments, setCreatedExperiments] = useState<ExperimentRecord[]>(() => loadCreatedRecords() as ExperimentRecord[]);
  const [experimentOverrides, setExperimentOverrides] = useState<Record<string, ExperimentRecord>>({});
  const [seedInputMode, setSeedInputMode] = useState<SeedInputMode>("manual");
  const [seedBase, setSeedBase] = useState("onboarding_core");
  const [seedManualList, setSeedManualList] = useState("member-copy-v2\nsearch_empty_safe\npay_coupon_holdout");
  const [seedTemplate, setSeedTemplate] = useState("{layer}:{scene}:{salt}");
  const [seedTemplateVars, setSeedTemplateVars] = useState("layer=onboarding_core\nscene=new_user\nsalt=blue");
  const [seedCount, setSeedCount] = useState(6);
  const [selectedSeed, setSelectedSeed] = useState("member-copy-v2");
  const [rolloutFilters, setRolloutFilters] = useState({ keyword: "", action: "all", operator: "all", dateFrom: "", dateTo: "" });
  const [sampleInput, setSampleInput] = useState({ businessLine: "增长", metricType: "转化率", baseline: 8.2, mde: 0.35, confidence: 95, power: 80, groups: 2, dailyTraffic: 180000, identityCoverage: 88, stableDays: 21, guardrailCount: 2, maxDays: 21, businessValue: 3.5 });
  const [sampleScope, setSampleScope] = useState({ domain: "增长", source: "历史 A/A", window: "近 14 天", unit: "用户" });
  const [checkTarget, setCheckTarget] = useState({ type: "当前实验" as CheckTargetType, experimentId: "EXP-240610-001", seed: selectedSeed });
  const [checkScope, setCheckScope] = useState<CheckScopeMode>("同业务域");
  const [manualCheckExperiments, setManualCheckExperiments] = useState<string[]>(["EXP-240611-017"]);
  const [orthMode, setOrthMode] = useState<OrthogonalityMode>("当前运行实验");
  const [preAAInput, setPreAAInput] = useState({ control: 8.21, variant: 8.18, sample: 280000 });
  const [uniformInput, setUniformInput] = useState({ a: 100820, b: 100130, split: 50 });
  const [orthInput, setOrthInput] = useState<[number, number, number, number]>([50240, 50120, 49880, 49760]);
  const [activeCheckTarget, setActiveCheckTarget] = useState("当前实验 / EXP-240610-001 · 新版首购引导流程");
  const [helpDrawer, setHelpDrawer] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [drawerStack, setDrawerStack] = useState<DrawerName[]>([]);
  const [focusedRolloutId, setFocusedRolloutId] = useState<string | null>(null);
  const [rolloutScope, setRolloutScope] = useState<"context" | "all">("context");
  const [monitorProblemTypes, setMonitorProblemTypes] = useState<string[]>([]);
  const [monitorView, setMonitorView] = useState<MonitorView>("alerts");
  const [selectedAlertId, setSelectedAlertId] = useState("ALT-002");
  const [alertRules, setAlertRules] = useState<AlertRuleRecord[]>(initialAlertRules);
  const [selectedRuleId, setSelectedRuleId] = useState(initialAlertRules[0].id);
  const [ruleDraft, setRuleDraft] = useState<AlertRuleRecord>({ ...initialAlertRules[0], recipients: [...initialAlertRules[0].recipients], audit: [...initialAlertRules[0].audit] });
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfile[]>(initialPermissionProfiles);
  const [selectedPermissionRole, setSelectedPermissionRole] = useState<PermissionRoleId>("experimentOwner");
  const [permissionAudit, setPermissionAudit] = useState([
    { id: "PERM-AUD-001", time: "2026-08-20 16:40", actor: "赵晨", target: "实验负责人", action: "增加启停自己规则权限" },
    { id: "PERM-AUD-002", time: "2026-08-18 10:12", actor: "李维", target: "分析人员", action: "可见范围调整为授权业务域" },
  ]);
  const [focusedRelationshipId, setFocusedRelationshipId] = useState("EXP-240611-017");
  const [relationshipFilters, setRelationshipFilters] = useState({ keyword: "", type: "all", risk: "all" });
  const [selectedMetricId, setSelectedMetricId] = useState("MET-001");
  const [metricDraft, setMetricDraft] = useState<any>(null);
  const [accessRequestDraft, setAccessRequestDraft] = useState({ scope: "metric", resourceId: "MET-003", permission: "metric.view", duration: "7", reason: "需要设计会员实验并查看历史基线" });
  const [toast, setToast] = useState<string | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const activeDrawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const activeNavRef = useRef<HTMLButtonElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const focusAnimationFrameRef = useRef<number | null>(null);
  const hadOpenDrawerRef = useRef(false);
  const activeDrawer = drawerStack[drawerStack.length - 1] ?? null;
  const hasOpenDrawer = Boolean(activeDrawer);
  const can = (permission: string, resource: any = {}) => canAccess(demoState, activeAccount, permission, resource);

  const persistDemoState = (next: typeof demoState) => {
    setDemoState(next);
    saveDemoState(next);
  };

  const ledgerExperiments = useMemo(() => [...createdExperiments, ...experiments.map((item) => experimentOverrides[item.id] ?? item)], [createdExperiments, experimentOverrides]);

  const filteredExperiments = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    const sourcePlatformKeyword = filters.sourcePlatformKeyword.trim().toLowerCase();
    const ownerKeyword = filters.owner.trim().toLowerCase();
    return ledgerExperiments.filter((item) => {
      const matchedKeyword = [item.id, item.name, item.owner, item.businessLine, item.coreMetric, item.trafficLayer]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
      const matchedSource =
        !sourcePlatformKeyword ||
        [item.sourcePlatform, item.sourceType, item.businessLine, item.userGroup, item.trafficLayer]
          .join(" ")
          .toLowerCase()
          .includes(sourcePlatformKeyword);
      return (
        matchedKeyword &&
        matchedSource &&
        can("experiment.view", item) &&
        (filters.businessLine === "all" || item.businessLine === filters.businessLine) &&
        (filters.status === "all" || item.status === filters.status) &&
        (!ownerKeyword || item.owner.toLowerCase().includes(ownerKeyword))
      );
    });
  }, [filters, ledgerExperiments]);
  const ledgerPagination = paginate(filteredExperiments, ledgerPage, LEDGER_PAGE_SIZE);
  const ledgerPageCount = ledgerPagination.pageCount;
  const currentLedgerPage = ledgerPagination.currentPage;
  const pagedExperiments = ledgerPagination.rows;
  const ledgerPageNumbers = Array.from({ length: ledgerPageCount }, (_, index) => index + 1);

  useEffect(() => {
    if (ledgerPage !== currentLedgerPage) setLedgerPage(currentLedgerPage);
    setLedgerPageInput(String(currentLedgerPage));
  }, [currentLedgerPage, ledgerPage]);

  const seedCandidates = useMemo(() => buildSeedCandidates(seedInputMode, seedManualList, seedTemplate, seedTemplateVars, seedBase, seedCount), [seedInputMode, seedManualList, seedTemplate, seedTemplateVars, seedBase, seedCount]);

  const sampleResult = useMemo(() => {
    const zAlpha = sampleInput.confidence === 99 ? 2.576 : sampleInput.confidence === 90 ? 1.645 : 1.96;
    const zBeta = sampleInput.power === 95 ? 1.64 : sampleInput.power === 90 ? 1.28 : 0.84;
    const p = sampleInput.baseline / 100;
    const delta = sampleInput.mde / 100;
    const perGroup = Math.ceil((2 * (zAlpha + zBeta) ** 2 * p * (1 - p)) / Math.max(0.0000001, delta ** 2));
    const total = perGroup * sampleInput.groups;
    const days = Math.max(1, Math.ceil(total / Math.max(1, sampleInput.dailyTraffic)));
    return { perGroup, total, days, ...getSampleFeasibility(days) };
  }, [sampleInput]);

  const preAAResult = calculatePreAA(preAAInput.control, preAAInput.variant, preAAInput.sample);
  const uniformResult = calculateUniformity(uniformInput.a, uniformInput.b, uniformInput.split);
  const orthResult = calculateOrthogonality(orthInput);
  const visibleGroups = navGroups
    .filter((group) => group.role === "all" || group.role === roleView)
    .map((group) => ({ ...group, items: group.items.filter((item) => {
      if (item.key === "metrics") return demoState.metrics.some((metric: any) => can("metric.view", metric) || can("metric.edit", metric));
      if (item.key === "access") return Boolean(activeAccount);
      return roleView === "admin" || !item.adminOnly;
    }) }));
  const activeLabel = activeTab === "create" ? "新建实验" : visibleGroups.flatMap((group) => group.items).find((item) => item.key === activeTab)?.label ?? "实验清单";
  const activeGroup = visibleGroups.find((group) => group.items.some((item) => item.key === activeTab));
  const breadcrumbGroup = activeTab === "list" || activeTab === "create" ? "首页" : activeGroup?.title ?? "工作台";
  const breadcrumbLabel = activeTab === "list" ? "实验清单" : activeLabel;
  const searchResults = useMemo(() => {
    const keyword = globalSearchKeyword.trim().toLowerCase();
    const experimentResults = experiments
      .filter((item) => !keyword || [item.id, item.name, item.owner, item.sourcePlatform, item.businessLine, item.trafficLayer].join(" ").toLowerCase().includes(keyword))
      .slice(0, 4)
      .map((item) => ({ type: "实验", title: item.name, meta: `${item.id} · ${item.owner} · ${item.sourcePlatform}`, action: () => openDetail(item) }));
    const rolloutResults = experiments
      .flatMap((item) => item.rolloutEvents.map((event) => ({ item, event })))
      .filter(({ item, event }) => !keyword || [item.id, item.name, event.reason, event.operator, event.sourcePlatform].join(" ").toLowerCase().includes(keyword))
      .slice(0, 3)
      .map(({ item, event }) => ({
        type: "放量事件",
        title: `${item.name} · ${event.type}`,
        meta: `${event.time} · ${event.from} -> ${event.to} · ${event.operator}`,
        action: () => {
          if (investigationContext?.caseId && investigationContext.experimentId === item.id) {
            navigateWithInvestigation("rollout", "rollout");
          } else {
            openDetail(item);
          }
        },
      }));
    const relationResults = relationRecords
      .filter((record) => !keyword || [record.sourceExperimentId, record.targetExperimentId, record.type, record.reason, record.scope].join(" ").toLowerCase().includes(keyword))
      .slice(0, 3)
      .map((record) => {
        const relationExperiment = experiments.find((item) => item.id === record.sourceExperimentId);
        return {
          type: "关系记录",
          title: `${record.sourceExperimentId} -> ${record.targetExperimentId}`,
          meta: `${record.type} · ${record.scope}`,
          action: () => {
            if (investigationContext?.caseId && (investigationContext.experimentId === record.sourceExperimentId || investigationContext.experimentId === record.targetExperimentId)) {
              navigateWithInvestigation("lineage", "relationship");
            } else {
              openDetail(relationExperiment ?? null);
            }
          },
        };
      });
    const sourceResults = Array.from(new Set(experiments.map((item) => item.sourcePlatform)))
      .filter((platform) => !keyword || platform.toLowerCase().includes(keyword))
      .slice(0, 3)
      .map((platform) => ({ type: "来源平台", title: platform, meta: "点击后在实验清单筛选来源关键词", action: () => { updateFilter("sourcePlatformKeyword", platform); navigateToTab("list"); } }));
    const seedResults = [
      { seed: selectedSeed, meta: "当前选择" },
      { seed: "member-copy-v2", meta: "Seed 记录 · 会员权益文案强化" },
      { seed: "search_empty_safe", meta: "Seed 记录 · 搜索无结果页改版" },
    ]
      .filter((row, index, array) => array.findIndex((item) => item.seed === row.seed) === index)
      .filter((row) => !keyword || row.seed.toLowerCase().includes(keyword))
      .slice(0, 3)
      .map((row) => ({ type: "Seed 记录", title: row.seed, meta: row.meta, action: () => navigateToTab("seedHistory") }));
    return [...experimentResults, ...rolloutResults, ...relationResults, ...sourceResults, ...seedResults].slice(0, 10);
  }, [globalSearchKeyword, selectedSeed, investigationContext]);

  const selectedCheckExperiment = experiments.find((item) => item.id === checkTarget.experimentId) ?? experiments[0];
  const activeValidationChecklist = validationChecklists.find((item) => item.experimentId === selectedCheckExperiment.id) ?? validationChecklists[0];
  const activeSplitPlan = trafficSplitPlans.find((item) => item.experimentId === selectedCheckExperiment.id) ?? trafficSplitPlans[0];
  const focusedRolloutExperiment = focusedRolloutId
    ? experiments.find((item) => item.id === focusedRolloutId) ?? null
    : rolloutScope === "context" && investigationContext
      ? experiments.find((item) => item.id === investigationContext.experimentId) ?? null
      : null;
  const detailEvidence = useMemo(() => {
    if (!selected) return [];
    const scopedContext = investigationContext?.experimentId === selected.id
      ? investigationContext
      : ({ experimentId: selected.id } as InvestigationContext);
    return buildEvidenceTimeline(scopedContext).slice(0, 5);
  }, [selected, investigationContext]);
  const sourcePlatformTips = ["平台接入", "表格导入", "手动补录"];
  const ownerTips = Array.from(new Set(ledgerExperiments.map((item) => item.owner)));
  const importPrecheckRows = runImportPrecheck(importRows);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setLedgerPage(1);
  }

  function updateFilterDraft(key: keyof LedgerFilters, value: string) {
    setFilterDraft((current) => ({ ...current, [key]: value }));
  }

  function openFilterDialog() {
    setFilterDraft({ ...filters });
    openDrawer("filters");
  }

  function openCreateExperimentDialog() {
    openDrawer("create");
  }

  function chooseCreateMethod(method: "import" | "direct") {
    closeTopmostDrawer();
    if (method === "import") {
      window.requestAnimationFrame(() => openDrawer("import"));
      return;
    }
    window.requestAnimationFrame(() => openCreateFlow());
  }

  function navigateToCreateStep(nextStep: CreateStep, options: { replace?: boolean } = {}) {
    setCreateStep(nextStep);
    setActiveTab("create");
    setInvestigationContext(null);
    setEvidenceTimeline([]);
    if (typeof window !== "undefined") {
      const nextHash = createExperimentHash(nextStep);
      if (window.location.hash !== nextHash || options.replace) {
        window.history[options.replace ? "replaceState" : "pushState"](null, "", nextHash);
      }
    }
  }

  function openCreateFlow() {
    const nextDraft = createDefaultDraft();
    clearCreateDraft();
    setCreateDraft(nextDraft);
    navigateToCreateStep("basic");
    showToast("已开启新的实验登记");
  }

  function saveCreateProgress(step = createStep) {
    const guardrailMetricIds = createDraft.basic.guardrailMetricIds.filter(Boolean);
    const guardrailMetric = (demoState.metrics as any[]).filter((metric) => guardrailMetricIds.includes(metric.id)).map((metric) => metric.name).join("、");
    const draft = { ...createDraft, savedStep: step, basic: { ...createDraft.basic, guardrailMetricIds, guardrailMetric }, sample: { ...createDraft.sample, guardrailCount: guardrailMetricIds.length } };
    const record = createLocalExperimentRecord(draft, "draft");
    const nextDraft = { ...draft, recordId: record.id };
    const nextRecord = { ...record, createDraft: nextDraft };
    setCreateDraft(nextDraft);
    if (!saveCreateDraft(nextDraft)) {
      showToast("本机草稿保存失败，请检查浏览器存储权限");
      return false;
    }
    setCreatedExperiments((current) => {
      const exists = current.some((item) => item.id === nextRecord.id);
      const nextRecords = exists ? current.map((item) => item.id === nextRecord.id ? nextRecord : item) : [nextRecord, ...current];
      saveCreatedRecords(nextRecords);
      return nextRecords;
    });
    return true;
  }

  function saveCreateToLedger() {
    if (!saveCreateProgress()) return;
    showToast("已保存到实验清单草稿，可继续当前编辑");
  }

  function validateAndAdvanceCreateStep() {
    if (createStep === "basic") {
      const range = createDraft.basic.sampleRange;
      const source = demoState.sampleSources.find((item: any) => item.id === range.sourceId);
      if (!source || !can("sample.use", source)) return showToast("请选择有使用权限的样本来源");
      if (!range.startDate || !range.endDate || range.startDate > range.endDate) return showToast("请选择有效的历史起止日期");
      if (range.sourceKind === "sql") {
        const result = validateSampleSql(range.sql);
        if (!result.valid) return showToast(result.error);
      }
      const filterResult = validateFilterCondition(range.filterCondition);
      if (!filterResult.valid) return showToast(filterResult.error);
      if (range.sourceKind === "task" && !range.taskId.trim()) return showToast("请输入推送任务 ID");
    }
    const errors = validateCreateStep(createDraft, createStep);
    if (errors.length) {
      showToast(`请补充：${errors[0]}`);
      return;
    }
    if (createStep === "seed") {
      const hasValidatedCustomSeed = createDraft.seed.customCandidate === createDraft.seed.selectedSeed && isValidCustomSeed(createDraft.seed.customCandidate);
      if (!isSeedGenerationCurrent(createDraft) && !hasValidatedCustomSeed) {
        showToast("生成配置已修改，请重新生成随机数种子");
        return;
      }
      if (!createDraft.seed.selectedSeed) {
        showToast("请选择一个随机数种子");
        return;
      }
      if (!saveCreateProgress("validation")) return;
      navigateToCreateStep("validation");
      return;
    }
    const nextStep = createStep === "basic" ? "sample" : createStep === "sample" ? "seed" : null;
    if (!nextStep || !saveCreateProgress(nextStep)) return;
    navigateToCreateStep(nextStep);
  }

  function updateCreateBasic(key: keyof CreateExperimentDraft["basic"], value: string) {
    setCreateDraft((current) => ({ ...current, basic: { ...current.basic, [key]: value }, seed: key === "domain" ? { ...current.seed, selectedSeed: "", customCandidate: "" } : current.seed }));
  }

  function updateSampleRange(patch: Partial<CreateExperimentDraft["basic"]["sampleRange"]>) {
    setCreateDraft((current) => {
      const sampleRange = { ...current.basic.sampleRange, ...patch };
      const source = demoState.sampleSources.find((item: any) => item.id === sampleRange.sourceId) ?? null;
      const snapshot = resolveHistoricalSnapshot(source, sampleRange.startDate, sampleRange.endDate);
      return { ...current, basic: { ...current.basic, sampleRange }, sample: { ...current.sample, baseline: snapshot.baseline, dailyTraffic: snapshot.dailyTraffic, identityCoverage: snapshot.coverage, stableDays: snapshot.stableDays }, seed: { ...current.seed, selectedSeed: "", customCandidate: "" } };
    });
  }

  function selectCoreMetric(metric: any) {
    if (!can("metric.view", metric)) return showToast("没有该指标的查看权限，可在我的权限中申请");
    setCreateDraft((current) => {
      const guardrailMetricIds = current.basic.guardrailMetricIds.filter((id) => id !== metric.id);
      const guardrailMetric = (demoState.metrics as any[]).filter((item) => guardrailMetricIds.includes(item.id)).map((item) => item.name).join("、");
      return { ...current, basic: { ...current.basic, coreMetricId: metric.id, coreMetric: metric.name, guardrailMetricIds, guardrailMetric }, sample: { ...current.sample, guardrailCount: guardrailMetricIds.filter(Boolean).length } };
    });
  }

  function setGuardrailMetric(index: number, metricId: string) {
    const metric = (demoState.metrics as any[]).find((item) => item.id === metricId);
    if (!metric) return;
    if (!can("metric.view", metric)) return showToast("没有该指标的查看权限，可在我的权限中申请");
    setCreateDraft((current) => {
      if (metric.id === current.basic.coreMetricId || current.basic.guardrailMetricIds.some((id, currentIndex) => id === metric.id && currentIndex !== index)) {
        showToast("同一实验中指标只能选择一次");
        return current;
      }
      const guardrailMetricIds = current.basic.guardrailMetricIds.map((id, currentIndex) => currentIndex === index ? metric.id : id);
      const guardrailMetric = (demoState.metrics as any[]).filter((item) => guardrailMetricIds.includes(item.id)).map((item) => item.name).join("、");
      return { ...current, basic: { ...current.basic, guardrailMetricIds, guardrailMetric }, sample: { ...current.sample, guardrailCount: guardrailMetricIds.filter(Boolean).length } };
    });
  }

  function addGuardrailMetric() {
    setCreateDraft((current) => ({ ...current, basic: { ...current.basic, guardrailMetricIds: [...current.basic.guardrailMetricIds, ""] } }));
  }

  function removeGuardrailMetric(index: number) {
    setCreateDraft((current) => {
      const guardrailMetricIds = current.basic.guardrailMetricIds.filter((_, currentIndex) => currentIndex !== index);
      const guardrailMetric = (demoState.metrics as any[]).filter((item) => guardrailMetricIds.includes(item.id)).map((item) => item.name).join("、");
      return { ...current, basic: { ...current.basic, guardrailMetricIds, guardrailMetric }, sample: { ...current.sample, guardrailCount: guardrailMetricIds.filter(Boolean).length } };
    });
  }

  function updateCreateSample(key: CreateSampleField, value: number) {
    setCreateDraft((current) => ({ ...current, sample: { ...current.sample, [key]: value } }));
  }

  function updateCreateSplitGroup(index: number, key: "label" | "ratio", value: string) {
    setCreateDraft((current) => ({
      ...current,
      sample: { ...current.sample, splitGroups: current.sample.splitGroups.map((group, groupIndex) => groupIndex === index ? { ...group, [key]: key === "ratio" ? Number(value) : value } : group) },
      seed: { ...current.seed, selectedSeed: "", customCandidate: "" },
    }));
  }

  function addCreateSplitGroup() {
    setCreateDraft((current) => {
      const index = current.sample.splitGroups.length;
      return {
        ...current,
        sample: { ...current.sample, splitGroups: [...current.sample.splitGroups, { id: `group-${Date.now()}-${index}`, label: String.fromCharCode(65 + index), ratio: 0 }] },
        seed: { ...current.seed, selectedSeed: "", customCandidate: "" },
      };
    });
  }

  function removeCreateSplitGroup(index: number) {
    setCreateDraft((current) => current.sample.splitGroups.length <= 2 ? current : {
      ...current,
      sample: { ...current.sample, splitGroups: current.sample.splitGroups.filter((_, groupIndex) => groupIndex !== index) },
      seed: { ...current.seed, selectedSeed: "", customCandidate: "" },
    });
  }

  function updateCreateSeedConfig(key: "sampleUnit" | "candidateCount" | "template", value: string | number) {
    setCreateDraft((current) => ({ ...current, seed: { ...current.seed, [key]: value, selectedSeed: "", customCandidate: "" } }));
  }

  function validateCustomCreateSeed() {
    const customSeed = createDraft.seed.customSeed.trim();
    if (!isValidCustomSeed(customSeed)) {
      showToast("自定义随机数种子需为 4-64 位字母、数字或 . _ : -");
      return;
    }
    setCreateDraft((current) => ({ ...current, seed: { ...current.seed, customSeed, customCandidate: customSeed, selectedSeed: customSeed } }));
    showToast("已完成自定义随机数种子校验并选中");
  }

  function generateCreateSeeds() {
    const errors = [...validateCreateStep(createDraft, "sample"), ...validateCreateStep(createDraft, "seed")];
    if (errors.length) return showToast(`请补充：${errors[0]}`);
    const maxAttempts = 20;
    let generated: GeneratedSeedConfig | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const key = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${attempt}`;
      const candidate: GeneratedSeedConfig = {
        key,
        domain: createDraft.basic.domain,
        sampleUnit: createDraft.seed.sampleUnit,
        candidateCount: createDraft.seed.candidateCount,
        template: createDraft.seed.template,
        attempts: attempt,
        splitGroups: createDraft.sample.splitGroups.map((group) => ({ ...group })),
      };
      generated = candidate;
      if (buildCreateSeedCandidates(candidate).some((item) => item.quality === "passed")) break;
    }
    const hasPassedCandidate = generated ? buildCreateSeedCandidates(generated).some((item) => item.quality === "passed") : false;
    setCreateDraft((current) => ({
      ...current,
      seed: {
        ...current.seed,
        selectedSeed: "",
        generated: generated ?? current.seed.generated,
      },
    }));
    showToast(hasPassedCandidate ? "已生成包含通过结果的随机数种子" : "未生成通过结果，请调整配置后重试");
  }

  function createLocalExperimentRecord(draft: CreateExperimentDraft, status: ExperimentStatus): ExperimentRecord {
    const now = new Date();
    const id = draft.recordId || `LOCAL-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${String(now.getTime()).slice(-4)}`;
    const timestamp = now.toISOString().slice(0, 16).replace("T", " ");
    const coreMetric = (demoState.metrics as any[]).find((metric) => metric.id === draft.basic.coreMetricId);
    const guardrailMetricIds = draft.basic.guardrailMetricIds.filter(Boolean);
    const guardrailMetrics = (demoState.metrics as any[]).filter((metric) => guardrailMetricIds.includes(metric.id));
    const sampleSource = (demoState.sampleSources as any[]).find((source) => source.id === draft.basic.sampleRange.sourceId);
    const historyWindow = `${draft.basic.sampleRange.startDate} 至 ${draft.basic.sampleRange.endDate}`;
    const finalSql = draft.basic.sampleRange.sourceKind === "sql" ? appendFilterCondition(draft.basic.sampleRange.sql, draft.basic.sampleRange.filterCondition) : "";
    return {
      id,
      name: draft.basic.name.trim() || "未命名草稿",
      businessLine: draft.basic.businessLine,
      sourcePlatform: "直接新增",
      sourceType: "平台接入",
      owner: draft.basic.owner.trim() || "未分配",
      relationship: "独立实验",
      parentExperiment: "-",
      trafficLayer: `${draft.basic.domain}_${draft.seed.sampleUnit}`.toLowerCase(),
      userGroup: draft.seed.sampleUnit,
      rollout: 0,
      status,
      quality: status === "draft" ? "warning" : "passed",
      startTime: timestamp,
      lastUpdated: timestamp,
      coreMetric: coreMetric ? `${coreMetric.name} v${coreMetric.version}` : draft.basic.coreMetric.trim() || "待填写",
      guardrailMetric: guardrailMetrics.length ? guardrailMetrics.map((metric) => `${metric.name} v${metric.version}`).join("、") : draft.basic.guardrailMetric.trim() || "待填写",
      stageStatus: "实验前",
      metricConfig: { metricType: "转化率", baseline: draft.sample.baseline, mde: draft.sample.mde, confidence: draft.sample.confidence, power: draft.sample.power, dailyTraffic: draft.sample.dailyTraffic },
      sampleDefinition: { domain: draft.basic.domain, source: sampleSource?.name ?? (draft.basic.sampleRange.sourceKind === "task" ? draft.basic.sampleRange.taskId : "自定义 SQL"), window: historyWindow, unit: draft.seed.sampleUnit, filterCondition: draft.basic.sampleRange.filterCondition, finalSql },
      reviewSummary: { conclusion: status === "draft" ? "本地草稿，待继续填写和完成校验。" : status === "pending" ? "已完成新增实验配置，等待上线。" : "实验已进入生命周期管理。", tags: [status === "draft" ? "草稿" : status === "pending" ? "待上线" : "直接新增", coreMetric ? `${coreMetric.id} v${coreMetric.version}` : "待选指标", sampleSource?.id ?? "自定义样本", draft.seed.selectedSeed || "未选择种子", draft.sample.splitGroups.map((group) => `${group.label}:${group.ratio}%`).join(" ")], similarExperiments: [], nextAction: status === "draft" ? "编辑草稿后继续" : status === "pending" ? "确认后上线" : "查看放量与校验快照" },
      alertStatus: "info",
      rolloutEvents: [],
      sourceQuality: "本地创建",
      importBatchId: "-",
      checkSnapshot: { target: draft.seed.selectedSeed || "待生成", preAA: status === "draft" ? "待校验" : "已通过", uniformity: status === "draft" ? "待校验" : "已通过", orthogonality: status === "draft" ? "待校验" : "已通过", sampleScope: `${draft.basic.domain} · ${draft.seed.sampleUnit}`, updatedAt: timestamp },
      auditEvents: [{ time: timestamp, operator: draft.basic.owner.trim() || "当前用户", action: status === "draft" ? "保存新增实验草稿" : status === "pending" ? "完成新增实验配置，等待上线" : "更新实验状态" }],
      ...(status === "draft" || status === "pending" ? { createDraft: { ...draft, basic: { ...draft.basic, guardrailMetricIds }, sample: { ...draft.sample, guardrailCount: guardrailMetricIds.length }, recordId: id, savedStep: status === "pending" ? "validation" : draft.savedStep } } : {}),
    };
  }

  function editCreateDraft(record: ExperimentRecord) {
    if (!record.createDraft) {
      showToast("该草稿缺少可恢复的新建信息");
      return;
    }
    const defaults = createDefaultDraft();
    const draft = {
      ...defaults,
      ...record.createDraft,
      recordId: record.id,
      basic: { ...defaults.basic, ...record.createDraft.basic },
      sample: { ...defaults.sample, ...record.createDraft.sample },
      seed: { ...defaults.seed, ...record.createDraft.seed, generated: { ...defaults.seed.generated, ...record.createDraft.seed.generated } },
      validation: { ...defaults.validation, ...record.createDraft.validation },
    };
    setCreateDraft(draft);
    saveCreateDraft(draft);
    navigateToCreateStep(draft.savedStep);
    showToast(`正在编辑草稿：${record.name}`);
  }

  function duplicateExperimentRecord(record: ExperimentRecord) {
    const sourceDraft = createDraftFromExperimentRecord(record);
    const draft = { ...sourceDraft, recordId: "", savedStep: "basic" as CreateStep, basic: { ...sourceDraft.basic, name: `${record.name}_copy` } };
    const copiedRecord = createLocalExperimentRecord(draft, "draft");
    const persistedDraft = { ...draft, recordId: copiedRecord.id };
    const nextRecord = { ...copiedRecord, createDraft: persistedDraft };
    setCreatedExperiments((current) => {
      const nextRecords = [nextRecord, ...current];
      saveCreatedRecords(nextRecords);
      return nextRecords;
    });
    showToast(`已复制为草稿：${persistedDraft.basic.name}`);
  }

  function completeCreateExperiment() {
    const errors = validateCreateStep(createDraft, "basic");
    if (errors.length || !createDraft.seed.selectedSeed) {
      showToast(errors.length ? `请补充：${errors[0]}` : "请先选择并带入一个候选种子");
      return;
    }
    const record = createLocalExperimentRecord({ ...createDraft, savedStep: "validation" }, "pending");
    setCreatedExperiments((current) => {
      const exists = current.some((item) => item.id === record.id);
      const nextRecords = exists ? current.map((item) => item.id === record.id ? record : item) : [record, ...current];
      saveCreatedRecords(nextRecords);
      return nextRecords;
    });
    clearCreateDraft();
    setCreateDraft(createDefaultDraft());
    navigateToTab("list");
    showToast(`已完成创建：${record.name}`);
  }

  function persistLedgerRecord(record: ExperimentRecord) {
    if (createdExperiments.some((item) => item.id === record.id)) {
      setCreatedExperiments((current) => {
        const nextRecords = current.map((item) => item.id === record.id ? record : item);
        saveCreatedRecords(nextRecords);
        return nextRecords;
      });
      return;
    }
    setExperimentOverrides((current) => ({ ...current, [record.id]: record }));
  }

  function updateExperimentLifecycle(record: ExperimentRecord, requestedAction = getExperimentStatusAction(record.status)) {
    const action = requestedAction;
    if (!action) return;
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace("T", " ");
    const nextStatus = action.next as ExperimentStatus;
    const nextRollout = nextStatus === "running" ? Math.max(record.rollout, 10) : 0;
    const updated: ExperimentRecord = {
      ...record,
      status: nextStatus,
      rollout: nextRollout,
      lastUpdated: timestamp,
      stageStatus: nextStatus === "running" ? "运行中" : nextStatus === "paused" ? "上线前" : "追溯复盘",
      rolloutEvents: [...record.rolloutEvents, { time: timestamp, type: action.action, from: `${record.rollout}%`, to: `${nextRollout}%`, operator: "当前用户", reason: `实验状态调整为${statusText[nextStatus]}`, sourcePlatform: "本地操作" }],
      auditEvents: [{ time: timestamp, operator: "当前用户", action: `${action.action}：${statusText[record.status]}→${statusText[nextStatus]}` }, ...record.auditEvents],
      createDraft: record.createDraft,
    };
    persistLedgerRecord(updated);
    showToast(`已${action.action}实验：${record.name}`);
  }

  function deleteExperimentRecord(record: ExperimentRecord) {
    if (!canDeleteExperiment(record.status)) return;
    if (!window.confirm(`确认删除“${record.name}”吗？此操作仅删除本机草稿或待上线记录。`)) return;
    if (createdExperiments.some((item) => item.id === record.id)) {
      setCreatedExperiments((current) => {
        const nextRecords = current.filter((item) => item.id !== record.id);
        saveCreatedRecords(nextRecords);
        return nextRecords;
      });
    } else {
      setExperimentOverrides((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
    }
    if (createDraft.recordId === record.id) {
      clearCreateDraft();
      setCreateDraft(createDefaultDraft());
    }
    showToast(`已删除：${record.name}`);
  }

  function resetLedgerFilters() {
    setFilters({ ...defaultLedgerFilters });
    setFilterDraft({ ...defaultLedgerFilters });
    setLedgerPage(1);
    showToast("已重置筛选条件");
  }

  function applyFilterDraft() {
    setFilters({ ...filterDraft });
    setLedgerPage(1);
    closeTopmostDrawer();
    showToast("已应用全部筛选条件");
  }

  function goToLedgerPage(page: number) {
    const nextPage = Math.max(1, Math.min(ledgerPageCount, Math.trunc(page) || 1));
    setLedgerPage(nextPage);
    setLedgerPageInput(String(nextPage));
  }

  function submitLedgerPageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToLedgerPage(Number(ledgerPageInput));
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }

  function openDrawer(drawer: DrawerName, experiment?: ExperimentRecord | null) {
    if (!hasOpenDrawer && typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }
    if (drawer === "detail" && experiment) setSelected(experiment);
    if (drawer === "help") setHelpDrawer(true);
    if (drawer === "import") setBulkImportOpen(true);
    if (drawer === "filters") setFilterDialogOpen(true);
    if (drawer === "create") setCreateExperimentOpen(true);
    setDrawerStack((current) => pushDrawer(current, drawer));
  }

  function openDetail(experiment: ExperimentRecord | null) {
    if (!experiment) return;
    if (!can("experiment.view", experiment)) {
      setAccessRequestDraft({ ...accessRequestDraft, scope: "experiment", resourceId: experiment.id, permission: "experiment.view" });
      navigateToTab("access");
      showToast("没有实验详情权限，可提交申请");
      return;
    }
    openDrawer("detail", experiment);
  }

  function closeTopmostDrawer() {
    const result = popDrawer(drawerStack);
    if (!result.closed) return;
    if (result.closed === "detail") setSelected(null);
    if (result.closed === "help") setHelpDrawer(false);
    if (result.closed === "import") setBulkImportOpen(false);
    if (result.closed === "filters") setFilterDialogOpen(false);
    if (result.closed === "create") setCreateExperimentOpen(false);
    setDrawerStack(result.stack);
  }

  function trapDrawerFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = getFocusTrapTarget(focusable.length, activeIndex, event.shiftKey);
    if (nextIndex === -1) {
      event.preventDefault();
      drawer.focus();
      return;
    }
    const expectedIndex = activeIndex + (event.shiftKey ? -1 : 1);
    if (activeIndex === -1 || nextIndex !== expectedIndex) {
      event.preventDefault();
      focusable[nextIndex]?.focus();
    }
  }

  function syncContextPageFocus(tab: Tab, context: InvestigationContext | null) {
    if (!context) return;
    if (tab === "lineage") {
      setFocusedRelationshipId(context.experimentId);
    }
    if (tab === "rollout") {
      setFocusedRolloutId(context.experimentId);
      setRolloutScope("context");
    }
    if (tab === "check") {
      setCheckTarget((current) => ({ ...current, experimentId: context.experimentId }));
    }
  }

  function navigateToTab(nextTab: Tab, options: { replace?: boolean; context?: InvestigationContext | null } = {}) {
    const safeTab = adminTabs.has(nextTab) && roleView !== "admin" ? "list" : nextTab;
    const nextContext = options.context === undefined ? investigationContext : options.context;
    syncContextPageFocus(safeTab, nextContext);
    setActiveTab(safeTab);
    setInvestigationContext(nextContext);
    setEvidenceTimeline(buildEvidenceTimeline(nextContext));
    if (typeof window !== "undefined") {
      const nextHash = buildInvestigationHash(safeTab, nextContext);
      if (window.location.hash !== nextHash || options.replace) {
        window.history[options.replace ? "replaceState" : "pushState"](null, "", nextHash);
      }
    }
  }

  function navigateWithInvestigation(tab: Tab, focus: EvidenceFocus) {
    if (!investigationContext) {
      showToast("请先从异常或实验详情建立本地排查上下文");
      return;
    }
    const nextContext = {
      ...investigationContext,
      evidenceFocus: focus,
    };
    setInvestigationContext(nextContext);
    setEvidenceTimeline(buildEvidenceTimeline(nextContext));
    saveInvestigationContext(nextContext);
    navigateToTab(tab, { context: nextContext });
  }

  function startInvestigation(experimentId: string, options: InvestigationStartOptions = {}) {
    const experiment = experiments.find((item) => item.id === experimentId);
    if (!experiment) {
      showToast("未找到对应实验，无法建立本地排查");
      return;
    }
    const alert = options.alertId ? monitorAlerts.find((item) => item.id === options.alertId && item.experimentId === experimentId) : undefined;
    const now = new Date();
    const draft: InvestigationContext = {
      caseId: createLocalCaseId(now),
      experimentId,
      ...(alert ? { alertId: alert.id } : {}),
      timeRange: options.timeRange ?? "14d",
      entrySource: options.entrySource ?? "monitor",
      evidenceFocus: options.focus ?? "overview",
      status: "idle",
      owner: alert?.owner ?? experiment.owner,
      collaborators: [],
      resolution: "",
      updatedAt: now.toISOString().slice(0, 16).replace("T", " "),
      actions: [],
    };
    const nextContext = transitionInvestigation(draft, "investigating", "已建立本地排查上下文");
    setInvestigationContext(nextContext);
    setEvidenceTimeline(buildEvidenceTimeline(nextContext));
    saveInvestigationContext(nextContext);
    navigateToTab(options.tab ?? "investigate", { context: nextContext });
    showToast("已建立本地排查上下文（演示状态，未写入生产系统）");
  }

  function focusExperimentInvestigation(experimentId: string, tab: Tab, focus: EvidenceFocus, entrySource: InvestigationContext["entrySource"]) {
    if (investigationContext?.caseId && investigationContext.experimentId === experimentId) {
      navigateWithInvestigation(tab, focus);
      return;
    }
    startInvestigation(experimentId, { tab, focus, entrySource });
  }

  function updateInvestigationStatus(nextStatus: InvestigationStatus, note: string) {
    if (!investigationContext) {
      showToast("请先建立本地排查上下文");
      return;
    }
    const normalizedNote = note.trim();
    if (["resolved", "closed"].includes(nextStatus) && normalizedNote.length < 6) {
      showToast("结束排查前请记录至少 6 个字符的本地结论");
      return;
    }
    try {
      const nextContext = transitionInvestigation(investigationContext, nextStatus, normalizedNote);
      setInvestigationContext(nextContext);
      setEvidenceTimeline(buildEvidenceTimeline(nextContext));
      saveInvestigationContext(nextContext);
      showToast(`本地排查状态已更新为${investigationStatusText[nextStatus]}（演示状态）`);
    } catch {
      showToast(`当前状态不能切换为${investigationStatusText[nextStatus]}`);
    }
  }

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        searchInputRef.current?.focus();
      } else if (event.key === "Escape") {
        if (activeDrawer) {
          closeTopmostDrawer();
        } else {
          setCommandOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeDrawer, drawerStack]);

  useEffect(() => {
    const body = document.body;
    if (!hasOpenDrawer) return;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const existingPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.overflow = "hidden";
    if (scrollbarWidth) body.style.paddingRight = `${existingPaddingRight + scrollbarWidth}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [hasOpenDrawer]);

  useEffect(() => {
    const isSafeFocusTarget = (target: HTMLElement | null): target is HTMLElement =>
      Boolean(target?.isConnected && !target.closest("[inert]"));
    const focusFallback = () => {
      const heading = mainRef.current?.querySelector<HTMLElement>("h1") ?? mainRef.current;
      if (heading && heading.tabIndex < 0) heading.tabIndex = -1;
      return [activeNavRef.current, searchInputRef.current, heading].find(isSafeFocusTarget) ?? null;
    };
    const scheduleFocus = (target: HTMLElement | null) => {
      focusAnimationFrameRef.current = window.requestAnimationFrame(() => {
        if (isSafeFocusTarget(target)) target.focus();
      });
    };
    if (activeDrawer) {
      scheduleFocus(activeDrawerCloseRef.current);
    } else if (hadOpenDrawerRef.current) {
      scheduleFocus(isSafeFocusTarget(previousFocusRef.current) ? previousFocusRef.current : focusFallback());
      previousFocusRef.current = null;
    }
    hadOpenDrawerRef.current = Boolean(activeDrawer);
    return () => {
      if (focusAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(focusAnimationFrameRef.current);
        focusAnimationFrameRef.current = null;
      }
    };
  }, [activeDrawer]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeNavRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const recovered = recoverInvestigationLocation(window.location.hash);
      const recoveredContext = enrichDirectInvestigationOwner(recovered.context);
      if (recovered.shouldPersist && recoveredContext) {
        saveInvestigationContext(recoveredContext);
      }
      if (recovered.invalidHash) {
        setInvestigationContext(recoveredContext);
        setEvidenceTimeline(buildEvidenceTimeline(recoveredContext));
        navigateToTab("list", { replace: true, context: recoveredContext });
        return;
      }
      if (recovered.tab === "create") {
        const rawStep = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("step");
        const requestedStep = readCreateStep(window.location.hash);
        const nextStep = rawStep && rawStep !== requestedStep ? (loadCreateDraft()?.savedStep ?? "basic") : requestedStep;
        setCreateStep(nextStep);
        setActiveTab("create");
        setInvestigationContext(null);
        setEvidenceTimeline([]);
        const canonicalHash = createExperimentHash(nextStep);
        if (window.location.hash !== canonicalHash) window.history.replaceState(null, "", canonicalHash);
        return;
      }
      if (adminTabs.has(recovered.tab as Tab) && roleView !== "admin") {
        navigateToTab("list", { replace: true, context: recoveredContext });
        return;
      }
      syncContextPageFocus(recovered.tab as Tab, recoveredContext);
      setActiveTab(recovered.tab as Tab);
      setInvestigationContext(recoveredContext);
      setEvidenceTimeline(buildEvidenceTimeline(recoveredContext));
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [roleView]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function switchRole(nextRole: RoleView) {
    setRoleView(nextRole);
    if (nextRole === "user" && adminTabs.has(activeTab)) {
      navigateToTab("list", { replace: true });
    }
    showToast(nextRole === "admin" ? "已切换为管理员视图" : "已切换为普通用户视图");
  }

  function selectDemoAccount(accountId: string) {
    const account = getAccount(accountId);
    if (!account) return;
    persistDemoState({ ...demoState, sessionAccountId: account.id, audit: [{ id: `AUTH-${Date.now()}`, time: new Date().toISOString().slice(0, 16).replace("T", " "), actor: account.name, action: "登录测试账号" }, ...demoState.audit] });
    setRoleView(account.role === "admin" ? "admin" : "user");
    navigateToTab("list", { replace: true, context: null });
  }

  function resetDemoData() {
    const next = createInitialDemoState();
    persistDemoState(next);
    setRoleView("user");
    setCreatedExperiments([]);
    saveCreatedRecords([]);
    clearCreateDraft();
    setCreateDraft(createDefaultDraft());
    navigateToTab("list", { replace: true, context: null });
  }

  function applyCheckTarget() {
    const target = selectedCheckExperiment;
    const seedText = checkTarget.type === "当前实验" ? target.id : checkTarget.type === "候选 seed" ? checkTarget.seed : `${target.trafficLayer}-batch`;
    const base = hashSeed(`${seedText}-${sampleScope.domain}-${sampleScope.source}-${sampleScope.window}-${sampleScope.unit}`);
    const control = Number((7.8 + (base % 110) / 100).toFixed(2));
    const variantDelta = ((base >>> 7) % 51) / 100 - 0.25;
    const variant = Number(Math.max(0.1, control + variantDelta).toFixed(2));
    const sample = 180000 + (base % 140000);
    const bucketA = 96000 + ((base >>> 5) % 9000);
    const bucketB = 96000 + ((base >>> 11) % 9000);
    const crossBase = 47000 + ((base >>> 3) % 7000);

    setPreAAInput({ control, variant, sample });
    setUniformInput({ a: bucketA, b: bucketB, split: 50 });
    setOrthInput([crossBase, crossBase - 120 + ((base >>> 9) % 420), crossBase - 260 + ((base >>> 15) % 500), crossBase - 380 + ((base >>> 21) % 520)]);
    setSampleScope((current) => ({ ...current, domain: target.businessLine }));
    setActiveCheckTarget(`${checkTarget.type} / ${seedText} · ${target.name}`);
    showToast(`已刷新 ${target.name} 的上线前检查项`);
  }

  function applySampleToSeed() {
    setSampleScope((current) => ({ ...current, domain: sampleInput.businessLine }));
    setSeedBase(`${sampleInput.businessLine}_${sampleScope.unit}`.toLowerCase());
    navigateToTab("seed");
    showToast("已将样本计划带入 Seed 评估");
  }

  function applySampleToCheck() {
    const target = experiments.find((item) => item.businessLine === sampleInput.businessLine) ?? experiments[0];
    setSampleScope((current) => ({ ...current, domain: sampleInput.businessLine }));
    setCheckTarget((current) => ({ ...current, type: "当前实验", experimentId: target.id }));
    setActiveCheckTarget(`样本评估带入 / ${target.id} · ${target.name}`);
    navigateToTab("check");
    showToast("已将样本计划带入上线前检查");
  }

  if (!activeAccount) {
    return <main className="demo-login-shell"><section className="demo-login"><div><h1>实验资产中心</h1><p>选择测试账号以验证不同资源权限、权限申请和审批流程。</p></div><div className="demo-account-grid">{TEST_ACCOUNTS.map((account) => <button key={account.id} type="button" onClick={() => selectDemoAccount(account.id)}><strong>{account.name}</strong><span>{account.id}</span><em>{({ admin: "管理员", businessOwner: "业务负责人", experimentOwner: "实验负责人", metricEditor: "指标编辑者", analyst: "分析人员", viewer: "只读申请人" } as Record<string, string>)[account.role]}</em></button>)}</div></section></main>;
  }

  return (
    <div className="app-shell" data-active-page={activeTab}>
      <aside className="sidebar" inert={hasOpenDrawer || undefined}>
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <span />
            <span />
          </div>
          <strong>实验资产中心</strong>
        </div>
        <nav className="sidebar-nav" aria-label="主导航">
          {visibleGroups.map((group) => (
            <section key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`nav-item ${activeTab === item.key ? "active" : ""}`}
                    data-nav-id={item.key}
                    aria-current={activeTab === item.key ? "page" : undefined}
                    ref={activeTab === item.key ? activeNavRef : undefined}
                    onClick={() => navigateToTab(item.key)}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <Icon size={17} strokeWidth={1.9} />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
        </aside>

      <div className="workspace" inert={hasOpenDrawer || undefined}>
        <header className="app-header">
          <div className={`global-search ${commandOpen ? "open" : ""}`}>
            <button className="quick-search-trigger" type="button" onClick={() => setCommandOpen(true)} aria-label="打开全局搜索">
              <Search size={15} />
            </button>
            <input
              ref={searchInputRef}
              aria-label="全局搜索实验、Seed 和放量事件"
              value={globalSearchKeyword}
              onFocus={() => setCommandOpen(true)}
              onChange={(event) => {
                setGlobalSearchKeyword(event.target.value);
                setCommandOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setCommandOpen(false);
              }}
              placeholder="搜索实验、seed、放量事件"
            />
            <kbd>Ctrl K</kbd>
            {commandOpen ? (
              <div className="command-palette">
                <div className="command-palette-title">
                  <strong>全局定位</strong>
                  <span>搜索实验、seed、放量事件；不会替代当前页面筛选</span>
                </div>
                <div className="command-results">
                  {searchResults.map((item) => (
                    <button
                      key={`${item.type}-${item.title}-${item.meta}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        item.action();
                        setCommandOpen(false);
                      }}
                    >
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      <em>{item.meta}</em>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="header-actions">
            <button id="headerHelpButton" className="circle-button header-help-button" type="button" aria-label="帮助文档" title="帮助文档" onClick={() => openDrawer("help")}>
              <HelpCircle size={17} />
            </button>
            <div className="account-menu">
              <button className="account-trigger" type="button" title="当前账号">
                <span className="avatar-dot">
                  <UserRound size={16} />
                </span>
                <strong>{activeAccount.name}</strong>
                <ChevronDown size={14} />
              </button>
              <div className="account-popover">
                <div className="account-summary">
                  <strong>{activeAccount.name}</strong>
                  <span>当前身份：{({ admin: "管理员", businessOwner: "业务负责人", experimentOwner: "实验负责人", metricEditor: "指标编辑者", analyst: "分析人员", viewer: "只读申请人" } as Record<string, string>)[activeAccount.role]}</span>
                </div>
                <button type="button" onClick={() => persistDemoState({ ...demoState, sessionAccountId: null })}><ListChecks size={15} /> 切换测试账号</button>
                {activeAccount.role === "admin" ? <button type="button" onClick={resetDemoData}><Settings size={15} /> 重置测试数据</button> : null}
              </div>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="main" tabIndex={-1}>
          <div className="breadcrumb-bar" data-breadcrumb-page={activeTab}>
            <span>{roleView === "admin" && ["importReview", "governance", "permission"].includes(activeTab) ? "管理后台" : breadcrumbGroup}</span>
            <span>/</span>
            <strong>{breadcrumbLabel}</strong>
          </div>
          {investigationContext?.caseId ? (
            <section
              className="investigation-context-bar"
              aria-label="当前本地排查上下文"
              data-investigation-experiment={investigationContext.experimentId}
              data-investigation-alert={investigationContext.alertId ?? ""}
              data-investigation-range={investigationContext.timeRange}
              data-investigation-focus={investigationContext.evidenceFocus}
            >
              <div className="investigation-context-main">
                <span className="investigation-context-case">本地临时排查编号 {investigationContext.caseId}</span>
                <strong>{investigationContext.experimentId}</strong>
                <span>近 {investigationContext.timeRange.replace("d", " 天")}</span>
                <span className={`investigation-status ${investigationContext.status}`} data-investigation-status={investigationContext.status}>{investigationStatusText[investigationContext.status]}</span>
                <span>负责人：{investigationContext.owner}</span>
                <span>{evidenceTimeline.length} 条证据</span>
              </div>
              <div className="investigation-context-actions">
                <button type="button" className="link-button" data-evidence-focus="overview" onClick={() => navigateWithInvestigation("investigate", "overview")}>查看证据</button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={investigationContext.status === "closed"}
                  onClick={() => {
                    const note = window.prompt("请输入本地排查结论（至少 6 个字符）", investigationContext.resolution);
                    if (note === null) return;
                    updateInvestigationStatus(investigationContext.status === "resolved" ? "closed" : "resolved", note);
                  }}
                >
                  {investigationContext.status === "closed" ? "本地排查已结束" : "结束本地排查"}
                </button>
              </div>
            </section>
          ) : null}
          {activeTab === "create" && renderCreateFlow()}
          {activeTab === "list" && renderLedger()}
          {activeTab === "metrics" && renderMetricLibrary()}
          {activeTab === "access" && renderAccessCenter()}
          {activeTab === "investigate" && renderInvestigation()}
          {activeTab === "lineage" && renderLineage()}
          {activeTab === "rollout" && renderRollout()}
          {activeTab === "seedHistory" && renderSeedHistory()}
          {activeTab === "myImports" && renderMyImports()}
          {roleView === "admin" && activeTab === "importReview" && renderImportReview()}
          {roleView === "admin" && activeTab === "governance" && renderGovernance()}
          {roleView === "admin" && activeTab === "permission" && renderPermission()}
        </main>
      </div>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      {selected && activeDrawer === "detail" ? (
        <div className="drawer-mask show" onClick={closeTopmostDrawer}>
          <aside ref={drawerRef} className="drawer detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-drawer-title" tabIndex={-1} onKeyDown={trapDrawerFocus} onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span>{selected.id}</span>
                <h2 id="detail-drawer-title">{selected.name}</h2>
              </div>
              <button ref={activeDrawerCloseRef} className="circle-button" type="button" aria-label="关闭实验详情" onClick={closeTopmostDrawer}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="drawer-summary">
              <div>
                <span>当前放量</span>
                <strong>{selected.rollout}%</strong>
              </div>
              <div>
                <span>父子关系</span>
                <strong>{selected.relationship}</strong>
              </div>
              <div>
                <span>质量状态</span>
                <strong>{qualityText[selected.quality]}</strong>
              </div>
              <div>
                <span>实验状态</span>
                <strong>{statusText[selected.status]}</strong>
              </div>
              <div>
                <span>最近校验</span>
                <strong>{selected.checkSnapshot.preAA.split(" ")[1] ?? "通过"}</strong>
              </div>
            </div>
            <div className="drawer-investigation-actions">
              <button
                type="button"
                className="primary-button"
                data-start-investigation={selected.id}
                onClick={() => {
                  closeTopmostDrawer();
                  if (investigationContext?.caseId && investigationContext.experimentId === selected.id) {
                    navigateWithInvestigation("investigate", "overview");
                  } else {
                    startInvestigation(selected.id, { entrySource: "detail", focus: "overview" });
                  }
                }}
              >
                {investigationContext?.caseId && investigationContext.experimentId === selected.id ? "继续排查" : "开始排查"}
              </button>
              <button type="button" className="ghost-button" onClick={() => {
                closeTopmostDrawer();
                if (investigationContext?.caseId && investigationContext.experimentId === selected.id) navigateWithInvestigation("lineage", "relationship");
                else startInvestigation(selected.id, { tab: "lineage", entrySource: "detail", focus: "relationship" });
              }}>关系证据</button>
              <button type="button" className="ghost-button" onClick={() => {
                closeTopmostDrawer();
                if (investigationContext?.caseId && investigationContext.experimentId === selected.id) navigateWithInvestigation("rollout", "rollout");
                else startInvestigation(selected.id, { tab: "rollout", entrySource: "detail", focus: "rollout" });
              }}>放量证据</button>
              <button type="button" className="ghost-button" onClick={() => showToast("当前详情已展示最近校验快照")}>校验快照</button>
            </div>
            <section className="drawer-section">
              <h3>基础信息</h3>
              <dl>
                <div>
                  <dt>来源平台</dt>
                  <dd>{selected.sourcePlatform}</dd>
                </div>
                <div>
                  <dt>负责人</dt>
                  <dd>{selected.owner}</dd>
                </div>
                <div>
                  <dt>核心指标</dt>
                  <dd>{selected.coreMetric}</dd>
                </div>
                <div>
                  <dt>护栏指标</dt>
                  <dd>{selected.guardrailMetric}</dd>
                </div>
                <div>
                  <dt>流量层</dt>
                  <dd>{selected.trafficLayer}</dd>
                </div>
                <div>
                  <dt>目标人群</dt>
                  <dd>{selected.userGroup}</dd>
                </div>
                <div>
                  <dt>样本口径</dt>
                  <dd>{selected.sampleDefinition.domain} · {selected.sampleDefinition.source} · {selected.sampleDefinition.unit}</dd>
                </div>
                <div>
                  <dt>实验状态</dt>
                  <dd>{statusText[selected.status]}</dd>
                </div>
              </dl>
            </section>
            {selected.createDraft ? <section className="drawer-section design-snapshot">
              <h3>实验设计快照</h3>
              <dl>
                <div><dt>核心指标</dt><dd>{selected.coreMetric}</dd></div>
                <div><dt>护栏指标</dt><dd>{selected.guardrailMetric}</dd></div>
                <div><dt>样本来源</dt><dd>{selected.sampleDefinition.source}</dd></div>
                <div><dt>历史时间</dt><dd>{selected.sampleDefinition.window}</dd></div>
                <div><dt>来源类型</dt><dd>{selected.createDraft.basic.sampleRange.sourceKind === "task" ? "推送任务" : "SQL"}</dd></div>
                <div><dt>过滤条件</dt><dd className="snapshot-rule">{selected.sampleDefinition.filterCondition || "未设置"}</dd></div>
                <div><dt>样本规则</dt><dd className="snapshot-rule">{selected.createDraft.basic.sampleRange.sourceKind === "task" ? `${selected.createDraft.basic.sampleRange.taskId}${selected.sampleDefinition.filterCondition ? ` · ${selected.sampleDefinition.filterCondition}` : ""}` : selected.sampleDefinition.finalSql || appendFilterCondition(selected.createDraft.basic.sampleRange.sql, selected.createDraft.basic.sampleRange.filterCondition)}</dd></div>
              </dl>
            </section> : null}
            <section className="drawer-section">
              <h3>复盘结论</h3>
              <div className="review-summary">
                <strong>{selected.reviewSummary.conclusion}</strong>
                <div className="checklist">
                  {selected.reviewSummary.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <p>相似实验：{selected.reviewSummary.similarExperiments.join("、")}</p>
                <p>下一步：{selected.reviewSummary.nextAction}</p>
              </div>
            </section>
            <section className="drawer-section">
              <h3>关联关系</h3>
              <div className="relation-list">
                {relationRecords
                  .filter((record) => record.sourceExperimentId === selected.id || record.targetExperimentId === selected.id)
                  .map((record) => {
                    const peerId = record.sourceExperimentId === selected.id ? record.targetExperimentId : record.sourceExperimentId;
                    const peer = experiments.find((item) => item.id === peerId);
                    return (
                      <div className="relation-card" key={record.id}>
                        <strong>{record.type}</strong>
                        <span>{peer ? `${peer.id} · ${peer.name}` : peerId}</span>
                        <p>{record.reason}</p>
                      </div>
                    );
                  })}
              </div>
            </section>
            <section className="drawer-section">
              <h3>实验分组含义</h3>
              <div className="group-meaning">
                <div>
                  <strong>A 组 · 对照组</strong>
                  <p>保留当前线上策略，不承载新策略，用于衡量自然波动和基准指标。</p>
                </div>
                <div>
                  <strong>B 组 · 实验组</strong>
                  <p>承载本实验的新策略或配置变化，与对照组在同一业务域样本内比较效果。</p>
                </div>
              </div>
            </section>
            <section className="drawer-section">
              <h3>最近校验结果</h3>
              <div className="check-snapshot">
                <span>{selected.checkSnapshot.sampleScope}</span>
                <strong>{selected.checkSnapshot.preAA}</strong>
                <strong>{selected.checkSnapshot.uniformity}</strong>
                <strong>{selected.checkSnapshot.orthogonality}</strong>
                <em>更新时间：{selected.checkSnapshot.updatedAt}</em>
              </div>
            </section>
            <section className="drawer-section">
              <h3>放量历史</h3>
              <div className="timeline">
                {selected.rolloutEvents.map((event) => (
                  <div className="timeline-item" key={`${selected.id}-${event.time}`}>
                    <i />
                    <div>
                      <strong>
                        {event.type}: {event.from} {"->"} {event.to}
                      </strong>
                      <span>
                        {event.time} · {event.operator}
                      </span>
                      <p>{event.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="drawer-section">
              <h3>统一证据时间线</h3>
              <div className="detail-evidence-timeline">
                {detailEvidence.map((event) => (
                  <div className={`detail-evidence-item ${event.severity}`} key={`detail-${event.id}`}>
                    <time>{event.occurredAt}</time>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.summary}</p>
                      <span>{event.sourcePlatform} · {event.operator}</span>
                    </div>
                  </div>
                ))}
                {!detailEvidence.length ? <p className="timeline-empty">当前实验没有可用的统一证据事件。</p> : null}
              </div>
            </section>
            <section className="drawer-section">
              <h3>来源与导入质量</h3>
              <div className="quality-panel">
                <strong>{selected.sourceQuality}</strong>
                <span>来源平台：{selected.sourcePlatform}</span>
                <span>导入批次：{selected.importBatchId}</span>
              </div>
            </section>
            <section className="drawer-section">
              <h3>变更审计</h3>
              <div className="timeline audit-timeline">
                {selected.auditEvents.map((event) => (
                  <div className="timeline-item" key={`${selected.id}-${event.time}-${event.action}`}>
                    <i />
                    <div>
                      <strong>{event.action}</strong>
                      <span>
                        {event.time} · {event.operator}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {helpDrawer && activeDrawer === "help" ? (
        <div className="drawer-mask helpDrawer show" id="helpDrawer" onClick={closeTopmostDrawer}>
          <aside ref={drawerRef} className="drawer help-drawer" role="dialog" aria-modal="true" aria-labelledby="help-drawer-title" tabIndex={-1} onKeyDown={trapDrawerFocus} onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span>实验检验帮助</span>
                <h2 id="help-drawer-title">Pre-AA、均匀性与正交性说明</h2>
              </div>
              <button ref={activeDrawerCloseRef} className="circle-button" type="button" aria-label="关闭浮层" onClick={closeTopmostDrawer}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <section className="drawer-section help-content">
              <h3>Pre-AA 检验</h3>
              <p>用于上线前检查候选实验或 seed 在历史 A/A 样本中的表现，确认分流前两组没有天然差异。建议优先绑定当前实验、候选 seed 和业务域样本口径。</p>
              <h3>均匀性指标</h3>
              <p>比较实际进入 A/B 桶的人数与目标分流比例的偏差。偏差越小、p 值越高，说明当前 seed 或分流规则更接近预期比例；若显著偏离，需要检查样本过滤、hash key 和业务域样本是否一致。</p>
              <h3>正交性检验</h3>
              <p>将目标实验与当前运行实验，或一批候选 seed 做交叉分布分析，用于发现流量层、人群或 seed 之间的相关性风险。结果应与父子实验和放量历史一起回溯。</p>
              <h3>业务域样本</h3>
              <p>不同业务域可能使用不同实验单位和样本来源，例如用户、设备、订单或会话。检验结果必须记录样本口径，避免跨部门排查时误用结论。</p>
            </section>
          </aside>
        </div>
      ) : null}

      {filterDialogOpen && activeDrawer === "filters" ? (
        <div className="drawer-mask filter-dialog-mask show" data-filter-dialog-mask onClick={closeTopmostDrawer}>
          <aside ref={drawerRef} className="drawer filter-dialog" data-filter-dialog role="dialog" aria-modal="true" aria-labelledby="filter-dialog-title" tabIndex={-1} onKeyDown={trapDrawerFocus} onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span>实验清单</span>
                <h2 id="filter-dialog-title">筛选项</h2>
              </div>
              <button ref={activeDrawerCloseRef} className="circle-button" type="button" aria-label="关闭筛选项" onClick={closeTopmostDrawer}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="filter-dialog-grid">
              <label className="field vertical filter-dialog-keyword-field">
                <span className="sr-only">实验 ID / 名称</span>
                <input data-filter-draft="keyword" value={filterDraft.keyword} onChange={(event) => updateFilterDraft("keyword", event.target.value)} placeholder="实验 ID / 名称" />
              </label>
              <label className="field vertical">
                <span className="sr-only">业务线</span>
                <select data-filter-draft="businessLine" value={filterDraft.businessLine} onChange={(event) => updateFilterDraft("businessLine", event.target.value)}>
                  <option value="all">业务线</option>
                  <option>增长</option>
                  <option>会员</option>
                  <option>推荐</option>
                  <option>交易</option>
                  <option>搜索</option>
                </select>
              </label>
              <label className="field vertical">
                <span className="sr-only">来源关键词</span>
                <input data-filter-draft="sourcePlatformKeyword" value={filterDraft.sourcePlatformKeyword} onChange={(event) => updateFilterDraft("sourcePlatformKeyword", event.target.value)} placeholder="来源关键词" list="source-platform-options" />
              </label>
              <label className="field vertical">
                <span className="sr-only">状态</span>
                <select data-filter-draft="status" value={filterDraft.status} onChange={(event) => updateFilterDraft("status", event.target.value)}>
                  <option value="all">状态</option>
                  <option value="running">运行中</option>
                  <option value="paused">已暂停</option>
                  <option value="ended">已结束</option>
                </select>
              </label>
              <label className="field vertical">
                <span className="sr-only">负责人</span>
                <input data-filter-draft="owner" value={filterDraft.owner} onChange={(event) => updateFilterDraft("owner", event.target.value)} list="owner-options" placeholder="负责人" />
              </label>
            </div>
            <div className="drawer-actions">
              <button className="ghost-button" type="button" onClick={closeTopmostDrawer}>取消</button>
              <button className="primary-button" type="button" onClick={applyFilterDraft}>确定</button>
            </div>
          </aside>
        </div>
      ) : null}

      {createExperimentOpen && activeDrawer === "create" ? (
        <div className="drawer-mask filter-dialog-mask show" data-create-experiment-mask onClick={closeTopmostDrawer}>
          <aside ref={drawerRef} className="drawer create-experiment-dialog" data-create-experiment-dialog role="dialog" aria-modal="true" aria-labelledby="create-experiment-title" tabIndex={-1} onKeyDown={trapDrawerFocus} onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span>实验清单</span>
                <h2 id="create-experiment-title">新建实验</h2>
              </div>
              <button ref={activeDrawerCloseRef} className="circle-button" type="button" aria-label="关闭新建实验" onClick={closeTopmostDrawer}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="create-experiment-options">
              <button className="create-path-button" data-create-method="import" type="button" onClick={() => chooseCreateMethod("import")}>
                <Upload size={20} aria-hidden="true" />
                <span>上传导入</span>
              </button>
              <button className="create-path-button" data-create-method="direct" type="button" onClick={() => chooseCreateMethod("direct")}>
                <FlaskConical size={20} aria-hidden="true" />
                <span>直接新增</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {bulkImportOpen && activeDrawer === "import" ? (
        <div className="drawer-mask show" onClick={closeTopmostDrawer}>
          <aside ref={drawerRef} className="drawer import-drawer" role="dialog" aria-modal="true" aria-labelledby="import-drawer-title" tabIndex={-1} onKeyDown={trapDrawerFocus} onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span>批量导入</span>
                <h2 id="import-drawer-title">提交导入草稿</h2>
              </div>
              <button ref={activeDrawerCloseRef} className="circle-button" type="button" aria-label="关闭批量导入" onClick={closeTopmostDrawer}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <section className="drawer-section">
              <h3>文件解析</h3>
              <div className="import-file-row">
                <div>
                  <strong>experiment_import_20260703.xlsx</strong>
                  <span>4 行记录 · 12 个字段 · 解析完成</span>
                </div>
                <button className="ghost-button" type="button" onClick={() => showToast("已重置上传状态，可重新选择文件")}>重新上传</button>
              </div>
              <div className="checklist import-steps">
                <span>上传文件</span>
                <span>字段识别</span>
                <span>导入预检</span>
                <span>提交审核</span>
              </div>
            </section>
            <section className="drawer-section">
              <h3>导入预检</h3>
              <div className="import-summary">
                <span>通过 {importPrecheckRows.filter((row) => row.level === "通过").length}</span>
                <span>需确认 {importPrecheckRows.filter((row) => row.level === "需确认").length}</span>
                <span>阻断 {importPrecheckRows.filter((row) => row.level === "阻断").length}</span>
              </div>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>行号</th>
                    <th>实验</th>
                    <th>状态</th>
                    <th>问题</th>
                  </tr>
                </thead>
                <tbody>
                  {importPrecheckRows.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>{row.experimentId}</td>
                      <td>
                        <span className={`quality-badge ${row.level === "通过" ? "passed" : row.level === "需确认" ? "warning" : "critical"}`} aria-label={`导入预检第 ${row.row} 行状态：${row.level}`}>{row.level}</span>
                      </td>
                      <td>{row.issue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="drawer-actions">
                <button className="ghost-button" type="button" onClick={() => showToast("已生成问题行下载任务")}>下载问题行</button>
                <button className="primary-button" type="button" onClick={() => showToast("已提交审核，可在批量导入记录查看状态")}>提交审核</button>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );

  function renderCreateFlow() {
    const sample = createDraft.sample;
    const splitGroups = sample.splitGroups;
    const createSampleAssessment = calculateCreateSampleAssessment(sample);
    const { perGroup, splitPlan, total, days, periodStatus, splitErrors, splitMessage, recommendation, dimensions: createFeasibilityDimensions } = createSampleAssessment;
    const generated = createDraft.seed.generated;
    const generatedSplitRatio = generated.splitGroups.map((group) => `${group.label}:${group.ratio}%`).join(" ");
    const currentSplitRatio = splitGroups.map((group) => `${group.label}:${group.ratio}%`).join(" ");
    const seedBase = `${createDraft.basic.domain}_${createDraft.seed.sampleUnit}`.toLowerCase();
    const isGeneratedConfigCurrent = isSeedGenerationCurrent(createDraft);
    const generatedCandidates = buildCreateSeedCandidates(generated);
    const createSeedCandidates = rankCandidateResults([...generatedCandidates, ...(createDraft.seed.customCandidate ? [createSeedCandidate(createDraft.seed.customCandidate)] : [])].filter((item, index, array) => array.findIndex((candidate) => candidate.seed === item.seed) === index));
    const selectedCandidate = createSeedCandidates.find((item) => item.seed === createDraft.seed.selectedSeed) ?? createSeedCandidates[0] ?? null;
    const scopeExperiments = experiments.filter((item) => item.status === "running").filter((item) => {
      if (createDraft.validation.scope === "全部运行实验") return true;
      if (createDraft.validation.scope === "同业务域") return item.businessLine === createDraft.basic.domain;
      if (createDraft.validation.scope === "同分流层") return item.trafficLayer === seedBase;
      return createDraft.validation.manualExperimentIds.includes(item.id);
    });
    const validationBase = hashSeed(`${selectedCandidate?.seed ?? seedBase}-${createDraft.basic.domain}-${createDraft.seed.sampleUnit}-${createDraft.validation.scope}`);
    const preAA = calculatePreAA(
      Number((sample.baseline - 0.08 + (validationBase % 16) / 100).toFixed(2)),
      Number((sample.baseline - 0.08 + ((validationBase >>> 5) % 16) / 100).toFixed(2)),
      Math.max(1000, perGroup),
    );
    const referenceRatio = generated.splitGroups[0]?.ratio ?? 50;
    const uniformityTotal = 192000 + (validationBase % 16000);
    const uniformityA = Math.round(uniformityTotal * (referenceRatio / 100) + ((validationBase >>> 7) % 500) - 250);
    const uniformity = calculateUniformity(uniformityA, uniformityTotal - uniformityA, referenceRatio);
    const orthogonality = calculateOrthogonality([
      47000 + (validationBase % 6000),
      47000 + ((validationBase >>> 6) % 6000),
      47000 + ((validationBase >>> 12) % 6000),
      47000 + ((validationBase >>> 18) % 6000),
    ]);
    const ruleConflict = selectedCandidate ? selectedCandidate.conflictRisk >= 8 || scopeExperiments.some((item) => item.trafficLayer === seedBase) : false;
    const visibleMetrics = (demoState.metrics as any[]).filter((metric) => metric.status === "active" && can("metric.view", metric));
    const restrictedMetrics = (demoState.metrics as any[]).filter((metric) => metric.status === "active" && !can("metric.view", metric));
    const selectedGuardrailMetricIds = createDraft.basic.guardrailMetricIds.filter(Boolean);
    const coreMetricOptions = visibleMetrics.filter((metric) => metric.id === createDraft.basic.coreMetricId || !selectedGuardrailMetricIds.includes(metric.id));
    const getGuardrailMetricOptions = (index: number) => {
      const otherGuardrailMetricIds = createDraft.basic.guardrailMetricIds.filter((id, currentIndex) => currentIndex !== index && Boolean(id));
      return visibleMetrics.filter((metric) => metric.id !== createDraft.basic.coreMetricId && (metric.id === createDraft.basic.guardrailMetricIds[index] || !otherGuardrailMetricIds.includes(metric.id)));
    };
    const availableSources = (demoState.sampleSources as any[]).filter((source) => can("sample.use", source));
    const restrictedSources = (demoState.sampleSources as any[]).filter((source) => !can("sample.use", source));
    const selectedSource = availableSources.find((source) => source.id === createDraft.basic.sampleRange.sourceId) ?? availableSources[0] ?? null;
    const historySnapshot = resolveHistoricalSnapshot(selectedSource, createDraft.basic.sampleRange.startDate, createDraft.basic.sampleRange.endDate);
    const finalSampleSql = createDraft.basic.sampleRange.sourceKind === "sql" ? appendFilterCondition(createDraft.basic.sampleRange.sql, createDraft.basic.sampleRange.filterCondition) : "";
    const defaultSampleFields: Array<{ key: CreateSampleField; label: string }> = [
      { key: "baseline", label: "基准指标 %" }, { key: "mde", label: "MDE 百分点" }, { key: "confidence", label: "置信水平 %" }, { key: "power", label: "统计功效 %" },
      { key: "dailyTraffic", label: "日可用流量" }, { key: "identityCoverage", label: "身份覆盖率 %" }, { key: "maxDays", label: "最长可接受周期" },
    ];
    const additionalSampleFields: Array<{ key: CreateSampleField; label: string }> = [
      { key: "stableDays", label: "历史稳定天数" }, { key: "guardrailCount", label: "护栏指标数" }, { key: "businessValue", label: "预期业务价值 %" },
    ];
    const previousStep: Record<CreateStep, CreateStep | null> = { basic: null, sample: "basic", seed: "sample", validation: "seed" };
    const stepIndex = ["basic", "sample", "seed", "validation"].indexOf(createStep);
    const renderFooter = () => (
      <div className="create-flow-footer">
        <button className="ghost-button" data-create-save type="button" onClick={saveCreateToLedger}><FileCheck2 size={16} /> 保存</button>
        <button className="ghost-button" data-create-previous type="button" disabled={!previousStep[createStep]} onClick={() => previousStep[createStep] && navigateToCreateStep(previousStep[createStep]!)}>上一步</button>
        {createStep === "basic" || createStep === "sample" || createStep === "seed" ? <button className="primary-button" data-create-next type="button" onClick={validateAndAdvanceCreateStep}>下一步</button> : null}
        {createStep === "validation" ? <button className="primary-button" data-create-complete type="button" onClick={completeCreateExperiment}>完成创建</button> : null}
      </div>
    );

    return (
      <section className="module-page create-flow-page" data-page-id="create" data-page-core="create-experiment-wizard">
        <div className="page-heading">
          <div><h1>新增实验</h1><p>按步骤完成实验登记、样本量评估、分流配置和上线前检查。</p></div>
          <span className="quiet-badge">本机草稿</span>
        </div>
        <ol className="create-progress" aria-label="新增实验进度">
          {(["basic", "sample", "seed", "validation"] as CreateStep[]).map((step, index) => (
            <li key={step} className={index < stepIndex ? "completed" : index === stepIndex ? "active" : ""} aria-current={index === stepIndex ? "step" : undefined}>
              <span>{index + 1}</span><strong>{({ basic: "实验基本信息", sample: "样本量评估", seed: "分流方案", validation: "校验结果" } as Record<CreateStep, string>)[step]}</strong>
            </li>
          ))}
        </ol>

        {createStep === "basic" ? <>
          <Panel title="实验基本信息">
            <div className="form-grid create-basic-grid">
              <label className="field vertical wide-field"><span>实验名称</span><input data-create-basic="name" value={createDraft.basic.name} onChange={(event) => updateCreateBasic("name", event.target.value)} /></label>
              <label className="field vertical"><span>业务线</span><select data-create-basic="businessLine" value={createDraft.basic.businessLine} onChange={(event) => updateCreateBasic("businessLine", event.target.value)}><option>增长</option><option>会员</option><option>推荐</option><option>交易</option><option>搜索</option></select></label>
              <label className="field vertical"><span>实验域</span><select data-create-basic="domain" value={createDraft.basic.domain} onChange={(event) => updateCreateBasic("domain", event.target.value)}><option>增长</option><option>会员</option><option>推荐</option><option>交易</option><option>搜索</option></select></label>
              <label className="field vertical"><span>负责人</span><input data-create-basic="owner" value={createDraft.basic.owner} onChange={(event) => updateCreateBasic("owner", event.target.value)} list="owner-options" /></label>
              <label className="field vertical"><span>实验类型</span><select value={createDraft.basic.experimentType} onChange={(event) => updateCreateBasic("experimentType", event.target.value)}><option>A/B</option><option>A/A</option><option>灰度验证</option></select></label>
              <label className="field vertical"><span>计划开始时间</span><input type="date" value={createDraft.basic.planStartDate} onChange={(event) => updateCreateBasic("planStartDate", event.target.value)} /></label>
              <label className="field vertical wide-field"><span>实验假设</span><textarea data-create-basic="hypothesis" rows={4} value={createDraft.basic.hypothesis} onChange={(event) => updateCreateBasic("hypothesis", event.target.value)} /></label>
            </div>
            <section className="design-section" data-create-metric-selection>
              <h3>指标选择</h3>
              <div className="form-grid">
                <label className="field vertical">
                  <span>核心指标</span>
                  <select data-create-core-metric value={createDraft.basic.coreMetricId} onChange={(event) => { const metric = coreMetricOptions.find((item) => item.id === event.target.value); if (metric) selectCoreMetric(metric); }}>
                    <option value="">请选择核心指标</option>
                    {coreMetricOptions.map((metric) => <option key={metric.id} value={metric.id}>{metric.name} · {metric.updatedAt}</option>)}
                  </select>
                </label>
              </div>
              <div className="guardrail-metric-field">
                <div className="guardrail-metric-heading"><span>护栏指标（可选）</span><button className="inline-add-button" data-create-guardrail-add type="button" aria-label="新增护栏指标" title="新增护栏指标" onClick={addGuardrailMetric}><Plus size={15} /></button></div>
                {createDraft.basic.guardrailMetricIds.map((metricId, index) => <div className="guardrail-metric-row" key={`guardrail-${index}`}><select data-create-guardrail-select={index} value={metricId} onChange={(event) => setGuardrailMetric(index, event.target.value)}><option value="">请选择护栏指标</option>{getGuardrailMetricOptions(index).map((metric) => <option key={metric.id} value={metric.id}>{metric.name} · {metric.updatedAt}</option>)}</select><button className="icon-button guardrail-metric-remove" data-create-guardrail-remove={index} type="button" aria-label="删除护栏指标" title="删除护栏指标" onClick={() => removeGuardrailMetric(index)}><X size={15} /></button></div>)}
              </div>
              {restrictedMetrics.length ? <p className="hint">受限指标：{restrictedMetrics.map((metric) => <button key={metric.id} type="button" className="link-button" onClick={() => { setAccessRequestDraft({ ...accessRequestDraft, scope: "metric", resourceId: metric.id, permission: "metric.view" }); navigateToTab("access"); }}>{metric.id}</button>)}</p> : null}
            </section>
            <section className="design-section" data-create-sample-range>
              <h3>样本范围与历史时间</h3>
              <div className="form-grid">
                <label className="field vertical"><span>样本来源</span><select value={createDraft.basic.sampleRange.sourceId} onChange={(event) => { const source = availableSources.find((item) => item.id === event.target.value); updateSampleRange({ sourceId: event.target.value, sourceKind: source?.kind ?? "sql", taskId: source?.taskId ?? "" }); }}><option value="">请选择样本来源</option>{availableSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {source.frequency}</option>)}</select></label>
                <label className="field vertical"><span>随机化单位</span><select value={createDraft.seed.sampleUnit} onChange={(event) => updateCreateSeedConfig("sampleUnit", event.target.value)}><option>用户</option><option>设备</option><option>订单</option><option>会话</option></select></label>
                <label className="field vertical"><span>历史开始日期</span><input type="date" value={createDraft.basic.sampleRange.startDate} onChange={(event) => updateSampleRange({ startDate: event.target.value })} /></label>
                <label className="field vertical"><span>历史结束日期</span><input type="date" value={createDraft.basic.sampleRange.endDate} onChange={(event) => updateSampleRange({ endDate: event.target.value })} /></label>
                <label className="field vertical wide-field"><span>{createDraft.basic.sampleRange.sourceKind === "sql" ? "样本 SQL" : "推送任务 ID"}</span>{createDraft.basic.sampleRange.sourceKind === "sql" ? <textarea data-create-sample-sql rows={4} value={createDraft.basic.sampleRange.sql} onChange={(event) => updateSampleRange({ sql: event.target.value })} /> : <input data-create-sample-task value={createDraft.basic.sampleRange.taskId} onChange={(event) => updateSampleRange({ taskId: event.target.value })} />}</label>
                <label className="field vertical wide-field"><span>过滤条件</span><textarea data-create-filter-condition rows={3} placeholder="例如：entry = 'new_home' AND is_test_user = 0" value={createDraft.basic.sampleRange.filterCondition} onChange={(event) => updateSampleRange({ filterCondition: event.target.value })} /></label>
              </div>
              <div className="history-snapshot"><span>历史样本快照</span><strong>基线 {historySnapshot.baseline}%</strong><strong>日流量 {formatNumber(historySnapshot.dailyTraffic)}</strong><strong>覆盖率 {historySnapshot.coverage}%</strong><strong>稳定 {historySnapshot.stableDays} 天</strong><em>{historySnapshot.startDate} 至 {historySnapshot.endDate} · {historySnapshot.updatedAt || "无更新时间"}</em></div>
              {finalSampleSql ? <pre className="sample-sql-preview" data-create-final-sql>{finalSampleSql}</pre> : null}
            </section>
          </Panel>
          {!selectedSource && restrictedSources.length ? <p className="hint">当前账号没有可用样本来源。受限来源：{restrictedSources.map((source) => <button key={source.id} type="button" className="link-button" onClick={() => { setAccessRequestDraft({ ...accessRequestDraft, scope: "sampleSource", resourceId: source.id, permission: "sample.use" }); navigateToTab("access"); }}>{source.id}</button>)}</p> : null}
          {renderFooter()}
        </> : null}

        {createStep === "sample" ? <>
          <Panel title="样本量与测试周期">
            <div className="create-sample-grid">
              {defaultSampleFields.map((field) => <div key={field.key} data-create-sample-field={field.key}><NumberField label={field.label} value={sample[field.key]} onChange={(value) => updateCreateSample(field.key, value)} /></div>)}
              {createSampleExpanded ? additionalSampleFields.map((field) => <div key={field.key} data-create-sample-field={field.key}><NumberField label={field.label} value={sample[field.key]} onChange={(value) => updateCreateSample(field.key, value)} /></div>) : null}
            </div>
            <button className="link-button create-expand-button" type="button" onClick={() => setCreateSampleExpanded((current) => !current)}>{createSampleExpanded ? "收起" : "展开"}</button>
            <section className="create-split-config" aria-label="分流比例" data-create-split-config>
              <div className="create-split-heading"><div><div className="create-split-title-row"><h3>分流比例</h3><span className={`quality-badge ${splitErrors.length ? "critical" : "passed"}`} data-create-split-total>{splitMessage}</span></div><p>比例总和必须为 100%，最小比例组决定总样本量。</p></div></div>
              <div className="create-split-groups">
                {splitGroups.map((group, index) => <div className="create-split-group" key={group.id}>
                  <label className="field vertical"><span>实验组</span><input data-create-split-label={index} value={group.label} onChange={(event) => updateCreateSplitGroup(index, "label", event.target.value)} /></label>
                  <label className="field vertical"><span>比例 %</span><input data-create-split-ratio={index} type="number" min="1" max="100" step="1" value={group.ratio} onChange={(event) => updateCreateSplitGroup(index, "ratio", event.target.value)} /></label>
                  <button className="icon-button create-split-remove" type="button" aria-label={`删除 ${group.label} 组`} title={`删除 ${group.label} 组`} disabled={splitGroups.length <= 2} onClick={() => removeCreateSplitGroup(index)}><X size={16} /></button>
                </div>)}
              </div>
              {splitErrors.length ? <p className="create-split-validation" data-create-split-validation>{splitErrors[0]}</p> : null}
              <button className="ghost-button create-split-add" type="button" disabled={splitGroups.length >= 8} onClick={addCreateSplitGroup}><Plus size={16} /> 新增实验组</button>
            </section>
          </Panel>
          <Panel title="可行性结论">
            <div className="result-grid three-metrics" data-create-sample-results><Metric label="最小组所需样本量" value={formatNumber(perGroup)} /><Metric label="总样本量" value={formatNumber(total)} /><Metric label="预计周期" value={`${days} 天`} hint={`最长可接受周期 ${sample.maxDays} 天`} tone={periodStatus === "passed" ? "success" : periodStatus === "warning" ? "warning" : "danger"} /></div>
            <div className="create-allocation-summary" data-create-allocation-summary>{splitPlan.groups.map((group) => <span key={group.id}>{group.label} 组 {group.ratio}%：{formatNumber(group.samples)}</span>)}</div>
            <div className={`recommendation-panel ${periodStatus}`} data-create-period-recommendation><strong>{recommendation.label}</strong><p>{recommendation.advice}</p></div>
          </Panel>
          <section className="create-suggestion-panel" aria-label="建议方案">
            <div className="create-feasibility-live" data-create-feasibility-live><strong>五维可行性评估</strong><div>{createFeasibilityDimensions.map((item) => <section key={item.label}><span className={`quality-badge ${item.status}`}>{qualityText[item.status]}</span><b>{item.label}</b><em>{item.detail}</em></section>)}</div></div>
            <div><strong>替代方案</strong><span>扩大客群、调整 MDE、减少分组、延长周期、准实验、前后对比。</span></div>
          </section>
          {renderFooter()}
        </> : null}

        {createStep === "seed" ? <>
          <Panel title="随机数生成配置">
            <div className="create-seed-grid">
              <label className="field vertical"><span>样本口径</span><select data-create-seed-unit value={createDraft.seed.sampleUnit} onChange={(event) => updateCreateSeedConfig("sampleUnit", event.target.value)}><option>用户</option><option>设备</option><option>订单</option><option>会话</option></select></label>
              <NumberField label="候选种子数量" value={createDraft.seed.candidateCount} onChange={(value) => updateCreateSeedConfig("candidateCount", value)} />
              <label className="field vertical"><span>随机数种子模板（可选）</span><input data-create-seed-template value={createDraft.seed.template} onChange={(event) => updateCreateSeedConfig("template", event.target.value)} /></label>
              <label className="field vertical create-custom-seed-field"><span>自定义随机数种子</span><input data-create-custom-seed value={createDraft.seed.customSeed} onChange={(event) => setCreateDraft((current) => ({ ...current, seed: { ...current.seed, customSeed: event.target.value, selectedSeed: "", customCandidate: "" } }))} placeholder="4-64 位字母、数字或 . _ : -" /></label>
              <button className="ghost-button create-custom-seed-check" data-validate-custom-seed type="button" onClick={validateCustomCreateSeed}><FileCheck2 size={16} /> 校验自定义种子</button>
              <button className="primary-button create-seed-generate" data-create-seed-generate type="button" onClick={generateCreateSeeds}><Shuffle size={16} /> 生成随机数种子</button>
            </div>
            <div className="create-seed-summary" data-create-seed-summary><span><small>实验域</small><strong>{createDraft.basic.domain}</strong></span><span><small>分流比例</small><strong>{currentSplitRatio}</strong></span><span><small>实验组数</small><strong>{splitGroups.length} 组</strong></span></div>
          </Panel>
          <Panel title="候选种子列表">
            {!isGeneratedConfigCurrent ? <p className="create-seed-stale" data-create-seed-stale>生成配置已修改，请重新生成随机数种子后再带入上线前检查。</p> : null}
            <div className="table-wrap"><table className="data-table compact sticky-actions create-seed-table"><thead><tr><th>序号</th><th>候选种子</th><th>样本口径</th><th>分流比例</th><th>校验结果</th><th>选择随机数种子</th></tr></thead><tbody>
              {createSeedCandidates.map((item, index) => { const isCustomCandidate = item.seed === createDraft.seed.customCandidate; return <tr key={item.seed}><td>{index + 1}</td><td className="mono" data-create-seed-value>{item.seed}</td><td>{generated.domain} · {generated.sampleUnit}</td><td>{generatedSplitRatio}</td><td><span className={`quality-badge ${item.quality}`}>{item.quality === "passed" ? "通过" : item.quality === "warning" ? "警告" : "不通过"}</span><small className="table-score">评分 {item.score}{isCustomCandidate ? " · 自定义" : ""}</small></td><td><label className="create-seed-choice" title={`选择 ${item.seed}`}><input type="radio" name="create-seed-choice" data-create-seed-candidate value={item.seed} checked={createDraft.seed.selectedSeed === item.seed} disabled={!isGeneratedConfigCurrent && !isCustomCandidate} onChange={() => setCreateDraft((current) => ({ ...current, seed: { ...current.seed, selectedSeed: item.seed } }))} /><span className="sr-only">选择 {item.seed}</span></label></td></tr>; })}
            </tbody></table></div>
          </Panel>
          {renderFooter()}
        </> : null}

        {createStep === "validation" ? <>
          <Panel title="校验范围"><div className="create-validation-context"><label className="field vertical"><span>校验范围</span><select value={createDraft.validation.scope} onChange={(event) => setCreateDraft((current) => ({ ...current, validation: { ...current.validation, scope: event.target.value as CheckScopeMode } }))}>{(["全部运行实验", "同业务域", "同分流层", "手动指定"] as CheckScopeMode[]).map((scope) => <option key={scope}>{scope}</option>)}</select></label><label className="field vertical"><span>检验对象</span><input disabled value={`${createDraft.basic.name || "未命名实验"} · ${createDraft.seed.selectedSeed || "未选择种子"}`} /></label><label className="field vertical"><span>样本口径</span><input disabled value={`${createDraft.basic.domain} · ${currentSplitRatio} · 历史 A/A · 近 14 天 · ${createDraft.seed.sampleUnit}`} /></label></div>{createDraft.validation.scope === "手动指定" ? <div className="create-manual-scope-list">{experiments.filter((item) => item.status === "running").map((item) => <label key={item.id}><input type="checkbox" checked={createDraft.validation.manualExperimentIds.includes(item.id)} onChange={() => setCreateDraft((current) => ({ ...current, validation: { ...current.validation, manualExperimentIds: current.validation.manualExperimentIds.includes(item.id) ? current.validation.manualExperimentIds.filter((id) => id !== item.id) : [...current.validation.manualExperimentIds, item.id] } }))} /><span>{item.name}</span></label>)}</div> : <p className="hint">范围内运行实验 {scopeExperiments.length} 个</p>}</Panel>
          <Panel title="上线前检查结果"><div className="validation-list create-validation-list" data-create-validation-results>
            <div className={`validation-item ${preAA.passed ? "passed" : "critical"}`}><span>Pre-AA</span><strong>{preAA.passed ? "通过" : "不通过"}</strong><p>历史 A/A {preAA.passed ? "未见显著差异" : "存在显著差异"}</p><em>p = {preAA.pValue.toFixed(4)}</em></div>
            <div className={`validation-item ${uniformity.passed ? "passed" : "critical"}`}><span>均匀性</span><strong>{uniformity.passed ? "通过" : "不通过"}</strong><p>分桶偏差 {uniformity.deviation.toFixed(2)}%</p><em>p = {uniformity.pValue.toFixed(4)}</em></div>
            <div className={`validation-item ${orthogonality.passed ? "passed" : "warning"}`}><span>正交性</span><strong>{orthogonality.passed ? "通过" : "需关注"}</strong><p>{createDraft.validation.scope}下的交叉分布</p><em>p = {orthogonality.pValue.toFixed(4)}</em></div>
            <div className={`validation-item ${ruleConflict ? "warning" : "passed"}`}><span>规则冲突</span><strong>{ruleConflict ? "需关注" : "通过"}</strong><p>{ruleConflict ? "命中同层或候选种子风险" : "未命中阻断规则"}</p><em>范围内实验 {scopeExperiments.length} 个</em></div>
          </div></Panel>
          {renderFooter()}
        </> : null}
      </section>
    );
  }

  function renderLedger() {
    return (
      <section className="search-panel" data-page-id="list">
        <div className="panel-title">
          <div>
            <h1>实验清单</h1>
            <p>统一查看跨平台实验、父子关系、当前放量、校验状态和排查入口。</p>
          </div>
          <div className="ledger-heading-actions">
            <span className="quiet-badge">数据更新时间：2026-07-03 10:30</span>
          </div>
        </div>

        <div className="ledger-filter-bar">
          <div className="ledger-filter-grid" data-ledger-default-filters>
            <label className="field vertical ledger-keyword-field">
              <span className="sr-only">实验 ID / 名称</span>
              <input data-ledger-filter="keyword" value={filters.keyword} onChange={(event) => updateFilter("keyword", event.target.value)} placeholder="实验 ID / 名称" />
            </label>
            <label className="field vertical ledger-select-field">
              <span className="sr-only">业务线</span>
              <select value={filters.businessLine} onChange={(event) => updateFilter("businessLine", event.target.value)}>
                <option value="all">业务线</option>
                <option>增长</option>
                <option>会员</option>
                <option>推荐</option>
                <option>交易</option>
                <option>搜索</option>
              </select>
            </label>
            <label className="field vertical ledger-select-field">
              <span className="sr-only">状态</span>
              <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="all">状态</option>
                <option value="pending">待上线</option>
                <option value="running">运行中</option>
                <option value="draft">草稿</option>
                <option value="paused">已暂停</option>
                <option value="ended">已结束</option>
              </select>
            </label>
            <label className="field vertical ledger-owner-field">
              <span className="sr-only">负责人</span>
              <input data-ledger-filter="owner" value={filters.owner} onChange={(event) => updateFilter("owner", event.target.value)} list="owner-options" placeholder="负责人" />
            </label>
          </div>
          <div className="ledger-filter-actions">
            <button className="ghost-button" data-open-filter-dialog type="button" onClick={openFilterDialog} aria-haspopup="dialog">
              <SlidersHorizontal size={16} /> 筛选
            </button>
            <button className="ghost-button" data-reset-ledger type="button" onClick={resetLedgerFilters}>
              <RefreshCcw size={16} /> 重置
            </button>
            <button className="primary-button" data-open-create-experiment type="button" onClick={openCreateExperimentDialog} aria-haspopup="dialog">
              <Plus size={16} /> 新建实验
            </button>
            <button className="ghost-button" data-export-ledger type="button" onClick={() => showToast(`已准备导出 ${filteredExperiments.length} 条实验结果`)}>
              <Download size={16} /> 导出
            </button>
          </div>
        </div>

        <datalist id="source-platform-options">
          {sourcePlatformTips.map((tip) => (
            <option key={tip} value={tip} />
          ))}
        </datalist>
        <datalist id="owner-options">
          {ownerTips.map((owner) => (
            <option key={owner} value={owner} />
          ))}
        </datalist>

        {roleView === "admin" ? (
          <div className="toolbar ledger-admin-toolbar">
            <button className="ghost-button" type="button" onClick={() => navigateToTab("importReview")}>
              <Database size={16} /> 导入审核
            </button>
          </div>
        ) : null}

        <div className="table-wrap" data-page-core="experiment-ledger">
          <table className="data-table sticky-actions ledger-table">
            <thead>
              <tr>
                <th>实验</th>
                <th>业务与来源</th>
                <th>负责人</th>
                <th>关系</th>
                <th>放量/状态</th>
                <th>质量与更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedExperiments.map((item) => (
                <tr key={item.id}>
                  <td className="ledger-primary-cell">
                    <strong>{item.name}</strong>
                    <span className="mono">{item.id}</span>
                    <span>{item.coreMetric} · 护栏：{item.guardrailMetric}</span>
                  </td>
                  <td>
                    <div className="source-platform-cell">
                      <span>{item.businessLine} · {item.trafficLayer}</span>
                      <strong className="source-platform-name" title={item.sourcePlatform}>
                        {item.sourcePlatform}
                      </strong>
                      <span className="source-platform-meta">
                        <span className={`source-tag source-${item.sourceType}`}>{item.sourceType}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{item.owner}</strong>
                  </td>
                  <td>
                    <strong>{item.relationship}</strong>
                    <span>{item.parentExperiment === "-" ? "无父实验" : `父实验：${item.parentExperiment}`}</span>
                  </td>
                  <td>
                    <div className="rollout-cell">
                      <div>
                        <span style={{ width: `${item.rollout}%` }} />
                      </div>
                      <em>{item.rollout}%</em>
                    </div>
                    <span className={`status-dot ${item.status}`} aria-label={`实验状态：${statusText[item.status]}`}>
                      <i />
                      {statusText[item.status]}
                    </span>
                  </td>
                  <td>
                    <span className={`quality-badge ${item.quality}`}>{qualityText[item.quality]}</span>
                    <span>{item.lastUpdated}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" onClick={() => openDetail(item)}>查看详情</button>
                      <button type="button" data-duplicate-experiment={item.id} onClick={() => duplicateExperimentRecord(item)}>复制</button>
                      {(item.status === "draft" || item.status === "pending") && can("experiment.edit", item) ? <button type="button" data-edit-create-draft onClick={() => editCreateDraft(item)}>编辑</button> : null}
                      {can("experiment.lifecycle", item) ? getExperimentStatusActions(item.status).map((action) => <button type="button" key={action.next} data-experiment-lifecycle={`${item.status}-${action.next}`} onClick={() => updateExperimentLifecycle(item, action)}>{action.action}</button>) : null}
                      {canDeleteExperiment(item.status) ? <button type="button" className="ledger-delete-action" data-delete-experiment={item.id} onClick={() => deleteExperimentRecord(item)}>删除</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>Total: {filteredExperiments.length}</span>
          <button data-ledger-page-prev type="button" disabled={currentLedgerPage === 1} aria-label="上一页" onClick={() => goToLedgerPage(currentLedgerPage - 1)}>&lt;</button>
          {ledgerPageNumbers.map((page) => <button key={page} data-ledger-page={page} type="button" className={page === currentLedgerPage ? "active" : ""} aria-current={page === currentLedgerPage ? "page" : undefined} onClick={() => goToLedgerPage(page)}>{page}</button>)}
          <button data-ledger-page-next type="button" disabled={currentLedgerPage === ledgerPageCount} aria-label="下一页" onClick={() => goToLedgerPage(currentLedgerPage + 1)}>&gt;</button>
          <form className="pagination-jump" onSubmit={submitLedgerPageJump}>
            <label><span className="sr-only">跳转页码</span><input data-ledger-page-input type="number" min="1" max={ledgerPageCount} value={ledgerPageInput} onChange={(event) => setLedgerPageInput(event.target.value)} /></label>
            <span>/ {ledgerPageCount} 页</span>
            <button data-ledger-page-jump type="submit">跳转</button>
          </form>
          <span>{LEDGER_PAGE_SIZE} / Page</span>
        </div>
      </section>
    );
  }

  function renderMetricLibrary() {
    if (!activeAccount) return null;
    const metrics = demoState.metrics as any[];
    const selectedMetric = metrics.find((metric) => metric.id === selectedMetricId) ?? metrics[0];
    const canViewSelected = Boolean(selectedMetric && (can("metric.view", selectedMetric) || can("metric.edit", selectedMetric)));
    const draft = metricDraft ?? (canViewSelected ? selectedMetric : null);
    const canEditSelected = Boolean(draft && can("metric.edit", draft));
    const saveMetric = () => {
      if (!draft?.name?.trim() || !draft?.domain || !draft?.definition?.trim()) return showToast("请补齐指标名称、业务域和口径定义");
      const nextMetric = { ...draft, id: draft.id || `MET-${String(Date.now()).slice(-5)}`, updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "), freshness: "新鲜", owner: draft.owner || activeAccount.name, status: draft.status || "active", viewers: Array.isArray(draft.viewers) ? draft.viewers : [], editors: Array.isArray(draft.editors) ? draft.editors : [activeAccount.id] };
      if (!can("metric.edit", nextMetric) && activeAccount.role !== "admin") return showToast("没有该指标的编辑权限");
      const nextMetrics = metrics.some((metric) => metric.id === nextMetric.id) ? metrics.map((metric) => metric.id === nextMetric.id ? nextMetric : metric) : [nextMetric, ...metrics];
      persistDemoState({ ...demoState, metrics: nextMetrics, audit: [{ id: `METRIC-${Date.now()}`, time: nextMetric.updatedAt, actor: activeAccount.name, action: `${metrics.some((metric) => metric.id === nextMetric.id) ? "更新" : "新增"}指标 ${nextMetric.name}` }, ...demoState.audit] });
      setSelectedMetricId(nextMetric.id);
      setMetricDraft(null);
      showToast("指标已保存");
    };
    const deactivateMetric = () => {
      if (!selectedMetric || !can("metric.edit", selectedMetric)) return showToast("没有该指标的编辑权限");
      const nextMetrics = metrics.map((metric) => metric.id === selectedMetric.id ? { ...metric, status: "disabled", updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") } : metric);
      persistDemoState({ ...demoState, metrics: nextMetrics, audit: [{ id: `METRIC-${Date.now()}`, time: new Date().toISOString().slice(0, 16).replace("T", " "), actor: activeAccount.name, action: `停用指标 ${selectedMetric.name}` }, ...demoState.audit] });
      showToast("指标已停用；已被实验引用的指标保留历史版本");
    };
    return <section className="module-page metric-library" data-page-id="metrics" data-page-core="metric-library">
      <div className="page-heading">
        <div><h1>指标管理</h1><p>维护指标口径、来源、更新频率、业务域和资源级查看/编辑权限。</p></div>
        {activeAccount.role === "admin" || metrics.some((metric) => can("metric.edit", metric)) ? <button className="primary-button" type="button" onClick={() => setMetricDraft({ id: "", name: "", domain: activeAccount.domains[0] ?? "增长", definition: "", unit: "%", denominator: "", version: 1, sourceType: "table", sourceRef: "", refreshFrequency: "日更", updatedAt: "", freshness: "", owner: activeAccount.name, status: "active", viewers: [activeAccount.id], editors: [activeAccount.id] })}><Plus size={16} /> 新增指标</button> : null}
      </div>
      <div className="metric-library-layout">
        <section className="metric-list">
          {metrics.map((metric) => {
            const permitted = can("metric.view", metric) || can("metric.edit", metric);
            return <button key={metric.id} type="button" className={selectedMetric?.id === metric.id ? "active" : ""} onClick={() => { setSelectedMetricId(metric.id); setMetricDraft(null); }}><span className={`quality-badge ${metric.status === "active" ? "passed" : "warning"}`}>{metric.status === "active" ? "启用" : "停用"}</span><strong>{permitted ? metric.name : `受限指标 ${metric.id}`}</strong><small>{metric.domain} · v{metric.version}</small></button>;
          })}
        </section>
        <section className="metric-editor">{draft ? <>
          <div className="form-grid">
            <label className="field vertical"><span>指标名称</span><input disabled={!canEditSelected && Boolean(draft.id)} value={draft.name} onChange={(event) => setMetricDraft({ ...draft, name: event.target.value })} /></label>
            <label className="field vertical"><span>业务域</span><select disabled={!canEditSelected && Boolean(draft.id)} value={draft.domain} onChange={(event) => setMetricDraft({ ...draft, domain: event.target.value })}>{["增长", "会员", "推荐", "交易", "搜索"].map((domain) => <option key={domain}>{domain}</option>)}</select></label>
            <label className="field vertical"><span>单位</span><input disabled={!canEditSelected && Boolean(draft.id)} value={draft.unit} onChange={(event) => setMetricDraft({ ...draft, unit: event.target.value })} /></label>
            <label className="field vertical wide-field"><span>口径定义</span><textarea disabled={!canEditSelected && Boolean(draft.id)} rows={3} value={draft.definition} onChange={(event) => setMetricDraft({ ...draft, definition: event.target.value })} /></label>
            <label className="field vertical"><span>数据来源类型</span><select disabled={!canEditSelected && Boolean(draft.id)} value={draft.sourceType} onChange={(event) => setMetricDraft({ ...draft, sourceType: event.target.value })}><option value="table">线上表</option><option value="task">推送任务</option></select></label>
            <label className="field vertical"><span>表名 / 任务 ID</span><input disabled={!canEditSelected && Boolean(draft.id)} value={draft.sourceRef} onChange={(event) => setMetricDraft({ ...draft, sourceRef: event.target.value })} /></label>
            <label className="field vertical"><span>更新频率</span><select disabled={!canEditSelected && Boolean(draft.id)} value={draft.refreshFrequency} onChange={(event) => setMetricDraft({ ...draft, refreshFrequency: event.target.value })}><option>小时级</option><option>日更</option><option>周更</option></select></label>
            <label className="field vertical"><span>查看权限账号</span><input disabled={!canEditSelected && Boolean(draft.id)} value={(draft.viewers ?? []).join(",")} onChange={(event) => setMetricDraft({ ...draft, viewers: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
            <label className="field vertical"><span>编辑权限账号</span><input disabled={!canEditSelected && Boolean(draft.id)} value={(draft.editors ?? []).join(",")} onChange={(event) => setMetricDraft({ ...draft, editors: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
          </div>
          <div className="drawer-actions">{canEditSelected || !draft.id ? <button className="primary-button" type="button" onClick={saveMetric}>保存指标</button> : <button className="ghost-button" type="button" onClick={() => { setAccessRequestDraft({ ...accessRequestDraft, scope: "metric", resourceId: draft.id, permission: "metric.edit" }); navigateToTab("access"); }}>申请编辑权限</button>}{selectedMetric && canEditSelected ? <button className="ghost-button" type="button" onClick={deactivateMetric}>停用指标</button> : null}</div>
        </> : <p className="hint">请选择一个指标。</p>}</section>
      </div>
    </section>;
  }

  function renderAccessCenter() {
    if (!activeAccount) return null;
    const resources = accessRequestDraft.scope === "metric" ? demoState.metrics : accessRequestDraft.scope === "sampleSource" ? demoState.sampleSources : accessRequestDraft.scope === "domain" ? ["增长", "会员", "推荐", "交易", "搜索"].map((domain) => ({ id: domain, name: domain })) : ledgerExperiments;
    const ownRequests = activeAccount.role === "admin" ? demoState.requests : demoState.requests.filter((request: any) => request.accountId === activeAccount.id);
    const submitRequest = () => {
      if (!accessRequestDraft.reason.trim()) return showToast("请填写申请理由");
      if (demoState.requests.some((request: any) => request.accountId === activeAccount.id && request.scope === accessRequestDraft.scope && request.resourceId === accessRequestDraft.resourceId && request.permission === accessRequestDraft.permission && request.status === "pending")) return showToast("存在相同的待审批申请");
      const request = { id: `REQ-${Date.now()}`, accountId: activeAccount.id, accountName: activeAccount.name, ...accessRequestDraft, status: "pending", createdAt: new Date().toISOString().slice(0, 16).replace("T", " "), decisionNote: "" };
      persistDemoState({ ...demoState, requests: [request, ...demoState.requests], audit: [{ id: `REQ-AUD-${Date.now()}`, time: request.createdAt, actor: activeAccount.name, action: `提交权限申请 ${request.permission}` }, ...demoState.audit] });
      showToast("权限申请已提交");
    };
    const decideRequest = (request: any, approved: boolean) => {
      if (!can("access.approve")) return showToast("只有管理员可以审批");
      const updated = { ...request, status: approved ? "approved" : "rejected", decidedAt: new Date().toISOString().slice(0, 16).replace("T", " "), decisionNote: approved ? "已通过" : "已拒绝" };
      const grants = approved ? [{ id: `GRANT-${Date.now()}`, accountId: request.accountId, scope: request.scope, resourceId: request.resourceId, permissions: [request.permission], expiresAt: new Date(Date.now() + Number(request.duration) * 86400000).toISOString().slice(0, 10) }, ...demoState.grants] : demoState.grants;
      persistDemoState({ ...demoState, grants, requests: demoState.requests.map((item: any) => item.id === request.id ? updated : item), audit: [{ id: `REQ-AUD-${Date.now()}`, time: updated.decidedAt, actor: activeAccount.name, action: `${approved ? "通过" : "拒绝"}权限申请 ${request.id}` }, ...demoState.audit] });
    };
    return <section className="module-page access-center" data-page-id="access" data-page-core="access-center"><div className="page-heading"><div><h1>我的权限</h1><p>申请实验、业务域、指标或样本来源的查看和使用权限。</p></div></div><div className="module-grid two"><Panel title="申请权限"><div className="form-grid"><label className="field vertical"><span>资源范围</span><select value={accessRequestDraft.scope} onChange={(event) => setAccessRequestDraft({ ...accessRequestDraft, scope: event.target.value, resourceId: "" })}><option value="experiment">指定实验</option><option value="domain">业务域</option><option value="metric">指标</option><option value="sampleSource">样本来源</option></select></label><label className="field vertical"><span>目标资源</span><select value={accessRequestDraft.resourceId} onChange={(event) => setAccessRequestDraft({ ...accessRequestDraft, resourceId: event.target.value })}>{resources.map((resource: any) => <option key={resource.id} value={resource.id}>{resource.name ?? resource.id}</option>)}</select></label><label className="field vertical"><span>申请权限</span><select value={accessRequestDraft.permission} onChange={(event) => setAccessRequestDraft({ ...accessRequestDraft, permission: event.target.value })}><option value="metric.view">查看指标详情</option><option value="metric.edit">编辑指标</option><option value="experiment.view">查看实验详情</option><option value="sample.use">使用样本来源</option></select></label><label className="field vertical"><span>授权时效</span><select value={accessRequestDraft.duration} onChange={(event) => setAccessRequestDraft({ ...accessRequestDraft, duration: event.target.value })}><option value="7">7 天</option><option value="30">30 天</option></select></label><label className="field vertical wide-field"><span>申请理由</span><textarea rows={3} value={accessRequestDraft.reason} onChange={(event) => setAccessRequestDraft({ ...accessRequestDraft, reason: event.target.value })} /></label></div><button className="primary-button" type="button" onClick={submitRequest}>提交申请</button></Panel><Panel title={activeAccount.role === "admin" ? "审批队列" : "我的申请"}><div className="access-request-list">{ownRequests.map((request: any) => <div key={request.id}><strong>{request.permission}</strong><span>{request.scope} · {request.resourceId} · {request.status}</span><em>{request.accountName} · {request.createdAt}</em>{activeAccount.role === "admin" && request.status === "pending" ? <div className="row-actions"><button type="button" onClick={() => decideRequest(request, true)}>通过</button><button type="button" className="ledger-delete-action" onClick={() => decideRequest(request, false)}>拒绝</button></div> : null}</div>)}{!ownRequests.length ? <p className="hint">暂无申请记录</p> : null}</div></Panel></div></section>;
  }

  function renderEvaluation() {
    const feasibilityDimensions = [
      { label: "流量覆盖", status: sampleInput.identityCoverage >= 85 ? "passed" : sampleInput.identityCoverage >= 70 ? "warning" : "critical", detail: `身份覆盖 ${sampleInput.identityCoverage}%` },
      { label: "基线稳定", status: sampleInput.stableDays >= 14 ? "passed" : "warning", detail: `连续稳定 ${sampleInput.stableDays} 天` },
      { label: "实验污染", status: sampleInput.groups <= 3 ? "passed" : "warning", detail: `${sampleInput.groups} 组，需关注并行实验` },
      { label: "护栏完整", status: sampleInput.guardrailCount >= 2 ? "passed" : "critical", detail: `已配置 ${sampleInput.guardrailCount} 个护栏` },
      { label: "业务价值", status: sampleInput.businessValue >= sampleInput.mde ? "passed" : "warning", detail: `预期提升 ${sampleInput.businessValue}%，MDE ${sampleInput.mde}pp` },
    ] as Array<{ label: string; status: QualityStatus; detail: string }>;
    return (
      <section className="module-page stage-page" data-page-id="evaluate">
        <div className="page-heading">
          <div>
            <h1>实验评估</h1>
            <p>实验前先完成样本量与测试周期评估，判断当前业务域是否适合直接 A/B，再把结果带入分流和上线前检查。</p>
          </div>
          <span className={`quality-badge ${sampleResult.status}`}>{sampleResult.label}</span>
        </div>
        <div className="stage-flow" aria-label="实验阶段导航">
          {stageTargets.map((step, index) => (
            <button
              type="button"
              className={`stage-step ${stageByTab[activeTab] === step.tab ? "active" : ""}`}
              data-stage-target={step.tab}
              key={step.tab}
              aria-current={stageByTab[activeTab] === step.tab ? "step" : undefined}
              onClick={() => navigateToTab(step.tab)}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
            </button>
          ))}
        </div>
        <div className="module-grid two" data-page-core="sample-planning">
          <Panel title="样本量与测试周期">
            <div className="form-grid">
              <label className="field vertical">
                <span>业务域</span>
                <select value={sampleInput.businessLine} onChange={(event) => setSampleInput((current) => ({ ...current, businessLine: event.target.value }))}>
                  <option>增长</option>
                  <option>会员</option>
                  <option>推荐</option>
                  <option>交易</option>
                  <option>搜索</option>
                </select>
              </label>
              <label className="field vertical">
                <span>指标类型</span>
                <select value={sampleInput.metricType} onChange={(event) => setSampleInput((current) => ({ ...current, metricType: event.target.value }))}>
                  <option>转化率</option>
                  <option>点击率</option>
                  <option>均值类指标</option>
                  <option>护栏指标</option>
                </select>
              </label>
              <NumberField label="基准指标 %" value={sampleInput.baseline} onChange={(value) => setSampleInput((current) => ({ ...current, baseline: value }))} />
              <NumberField label="MDE 百分点" value={sampleInput.mde} onChange={(value) => setSampleInput((current) => ({ ...current, mde: value }))} />
              <NumberField label="置信水平 %" value={sampleInput.confidence} onChange={(value) => setSampleInput((current) => ({ ...current, confidence: value }))} />
              <NumberField label="统计功效 %" value={sampleInput.power} onChange={(value) => setSampleInput((current) => ({ ...current, power: value }))} />
              <NumberField label="实验组数" value={sampleInput.groups} onChange={(value) => setSampleInput((current) => ({ ...current, groups: value }))} />
              <NumberField label="日可用流量" value={sampleInput.dailyTraffic} onChange={(value) => setSampleInput((current) => ({ ...current, dailyTraffic: value }))} />
              <NumberField label="身份覆盖率 %" value={sampleInput.identityCoverage} onChange={(value) => setSampleInput((current) => ({ ...current, identityCoverage: value }))} />
              <NumberField label="历史稳定天数" value={sampleInput.stableDays} onChange={(value) => setSampleInput((current) => ({ ...current, stableDays: value }))} />
              <NumberField label="护栏指标数" value={sampleInput.guardrailCount} onChange={(value) => setSampleInput((current) => ({ ...current, guardrailCount: value }))} />
              <NumberField label="最长可接受周期" value={sampleInput.maxDays} onChange={(value) => setSampleInput((current) => ({ ...current, maxDays: value }))} />
            </div>
          </Panel>
          <Panel title="可行性结论">
            <div className="result-grid three-metrics">
              <Metric label="每组样本量" value={formatNumber(sampleResult.perGroup)} />
              <Metric label="总样本量" value={formatNumber(sampleResult.total)} />
              <Metric label="预计周期" value={`${sampleResult.days} 天`} tone={sampleResult.status === "passed" ? "success" : sampleResult.status === "warning" ? "warning" : "danger"} />
            </div>
            <div className={`recommendation-panel ${sampleResult.status}`}>
              <strong>{sampleResult.label}</strong>
              <p>{sampleResult.advice}</p>
            </div>
            <div className="flow-actions">
              <button className="primary-button" onClick={applySampleToSeed}>
                <Shuffle size={16} /> 带入分流方案
              </button>
              <button className="ghost-button" onClick={applySampleToCheck}>
                <FileCheck2 size={16} /> 带入上线前校验
              </button>
            </div>
          </Panel>
        </div>
        <div className="module-grid two feasibility-detail-grid">
          <Panel title="五维可行性评估">
            <div className="feasibility-dimensions">
              {feasibilityDimensions.map((item) => <div key={item.label}><span className={`quality-badge ${item.status}`}>{qualityText[item.status]}</span><strong>{item.label}</strong><p>{item.detail}</p></div>)}
            </div>
          </Panel>
          <Panel title="替代方案">
            <div className="alternative-actions">
              {["扩大客群", "调整 MDE", "减少分组", "延长周期", "准实验", "前后对比"].map((item) => <button type="button" key={item} onClick={() => showToast(`已将“${item}”加入方案比较`)}>{item}</button>)}
            </div>
            <p className="hint">当流量、稳定性或护栏不满足时，先比较替代方案，再进入分流与上线前检查。</p>
          </Panel>
        </div>
        <Panel title="历史样本计划">
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>计划 ID</th>
                  <th>业务域</th>
                  <th>指标类型</th>
                  <th>基准指标</th>
                  <th>MDE</th>
                  <th>样本量</th>
                  <th>周期</th>
                  <th>可行性</th>
                  <th>建议</th>
                </tr>
              </thead>
              <tbody>
                {samplePlans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="mono">{plan.id}</td>
                    <td>{plan.businessLine}</td>
                    <td>{plan.metricType}</td>
                    <td>{plan.baseline}%</td>
                    <td>{plan.mde}pp</td>
                    <td>{formatNumber(plan.total)}</td>
                    <td>{plan.days} 天</td>
                    <td>
                      <span className={`quality-badge ${plan.feasibility}`}>{qualityText[plan.feasibility]}</span>
                    </td>
                    <td>{plan.advice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    );
  }

  function renderOverview() {
    return (
      <section className="module-page">
        <div className="page-heading">
          <h1>实验总览</h1>
          <p>把分散在各业务线的实验记录、放量变更和风险状态放到同一个可排查视图里。</p>
        </div>
        <div className="metric-grid compact-metrics">
          <Metric label="运行实验" value="38" hint="跨 7 条业务线" />
          <Metric label="待补齐记录" value="12" hint="字段缺失或更新时间过旧" tone="warning" />
          <Metric label="疑似冲突" value="4" hint="同层流量或人群重叠" tone="danger" />
          <Metric label="本周放量事件" value="27" hint="含启动、暂停、结束" />
        </div>
        <div className="module-grid two">
          <Panel title="重点排查">
            <ul className="plain-list">
              <li>推荐位排序策略与搜索召回策略共享 `rec_home` 流量层，需要确认互斥规则。</li>
              <li>会员权益文案强化存在子实验，长期反转排查时需同时查看父实验指标。</li>
              <li>支付页优惠提醒为手动补录，当前缺少完整 Pre-AA 检验记录。</li>
            </ul>
          </Panel>
          <Panel title="近期放量">
            {experiments.slice(0, 3).map((item) => (
              <div className="compact-row" key={item.id}>
                <span>{item.name}</span>
                <strong>{item.rollout}%</strong>
              </div>
            ))}
          </Panel>
        </div>
      </section>
    );
  }

  function renderLineageWorkbench() {
    const focusedExperiment = experiments.find((item) => item.id === focusedRelationshipId) ?? experiments[0];
    const relatedRecords = relationRecords.filter((record) => record.sourceExperimentId === focusedExperiment.id || record.targetExperimentId === focusedExperiment.id);
    const relationshipPlacements = relatedRecords.flatMap((record) => {
      const placement = relationshipPlacementForFocus(record, focusedExperiment.id);
      return placement ? [{ record, ...placement }] : [];
    });
    const upstreamRelations = relationshipPlacements.filter((item) => item.side === "upstream");
    const downstreamRelations = relationshipPlacements.filter((item) => item.side === "downstream");
    const focusedChangeEvents = relationshipChangeEvents
      .filter((change) => relatedRecords.some((record) => record.id === change.relationshipId))
      .sort((left, right) => right.time.localeCompare(left.time));
    const keyword = relationshipFilters.keyword.trim().toLowerCase();
    const filteredRelations = relationRecords.filter((record) => {
      const source = experiments.find((item) => item.id === record.sourceExperimentId);
      const target = experiments.find((item) => item.id === record.targetExperimentId);
      return (!keyword || [record.sourceExperimentId, record.targetExperimentId, source?.name, target?.name, record.reason].join(" ").toLowerCase().includes(keyword))
        && (relationshipFilters.type === "all" || record.type === relationshipFilters.type)
        && (relationshipFilters.risk === "all" || record.risk === relationshipFilters.risk);
    });
    const renderRelationshipNode = (experiment: ExperimentRecord, relation?: RelationshipRecord) => (
      <article className={`relationship-node ${relation?.risk ?? experiment.quality}`} data-relationship-node={experiment.id} key={`${experiment.id}-${relation?.id ?? "current"}`}>
        <div className="relationship-node-header">
          <span className={`status-dot ${experiment.status}`}><i />{statusText[experiment.status]}</span>
          {relation ? <span className={`quality-badge ${relation.risk}`}>{qualityText[relation.risk]}</span> : <span className={`quality-badge ${experiment.quality}`}>{qualityText[experiment.quality]}</span>}
        </div>
        <strong>{experiment.name}</strong>
        <span className="mono">{experiment.id}</span>
        <dl>
          <div><dt>来源</dt><dd>{experiment.sourcePlatform}</dd></div>
          <div><dt>放量</dt><dd>{experiment.rollout}%</dd></div>
          {relation ? <div><dt>关系</dt><dd>{relation.type} · {relation.scope}</dd></div> : <div><dt>分流层</dt><dd>{experiment.trafficLayer}</dd></div>}
        </dl>
        <button className="link-button" type="button" onClick={() => openDetail(experiment)}>查看详情</button>
      </article>
    );

    return (
      <section className="module-page relationship-workbench" data-page-id="lineage">
        <div className="page-heading">
          <div>
            <h1>父子实验</h1>
            <p>围绕一个实验还原上下游关系、互斥风险和关系变更，避免排查时只看到孤立记录。</p>
          </div>
          <label className="compact-select">
            <span>聚焦实验</span>
            <select value={focusedExperiment.id} onChange={(event) => setFocusedRelationshipId(event.target.value)}>
              {experiments.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}
            </select>
          </label>
        </div>

        <div className="relationship-map" aria-label="实验关系链路" data-page-core="relationship-map">
          <section className="relationship-column">
            <h2>上游与父实验</h2>
            {upstreamRelations.length ? upstreamRelations.map(({ record, peerId }) => {
              const peer = experiments.find((item) => item.id === peerId);
              return peer ? renderRelationshipNode(peer, record) : null;
            }) : <p className="relationship-empty">当前未登记上游关系。</p>}
          </section>
          <section className="relationship-column current">
            <h2>当前实验</h2>
            {renderRelationshipNode(focusedExperiment)}
            <p className="relationship-summary-text">样本口径：{focusedExperiment.sampleDefinition.domain} · {focusedExperiment.sampleDefinition.unit}；当前阶段：{focusedExperiment.stageStatus}</p>
          </section>
          <section className="relationship-column">
            <h2>下游与互斥实验</h2>
            {downstreamRelations.length ? downstreamRelations.map(({ record, peerId }) => {
              const peer = experiments.find((item) => item.id === peerId);
              return peer ? renderRelationshipNode(peer, record) : null;
            }) : <p className="relationship-empty">当前未登记下游或互斥关系。</p>}
          </section>
        </div>

        <div className="relationship-risk-row" aria-label="关系风险队列">
          <strong>关系风险</strong>
          {relatedRecords.filter((record) => record.risk !== "passed").map((record) => (
            <div className="relationship-risk-item" key={record.id}>
              <span className={`quality-badge ${record.risk}`}>{qualityText[record.risk]}</span>
              <span>{record.type} · {record.reason}</span>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  if (investigationContext?.caseId && investigationContext.experimentId === focusedExperiment.id) {
                    navigateWithInvestigation("lineage", "relationship");
                  } else {
                    startInvestigation(focusedExperiment.id, { tab: "lineage", entrySource: "relationship", focus: "relationship" });
                  }
                }}
              >
                加入排查
              </button>
            </div>
          ))}
          {!relatedRecords.some((record) => record.risk !== "passed") ? <span className="relationship-empty">当前关系无待处理风险。</span> : null}
        </div>

        <div className="filter-grid slim-filter relationship-filters">
          <label className="field"><span>关系关键词</span><input value={relationshipFilters.keyword} onChange={(event) => setRelationshipFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="实验 ID、名称或关联原因" /></label>
          <label className="field"><span>关系类型</span><select value={relationshipFilters.type} onChange={(event) => setRelationshipFilters((current) => ({ ...current, type: event.target.value }))}><option value="all">全部关系</option><option>父实验</option><option>子实验</option><option>关联实验</option><option>互斥实验</option></select></label>
          <label className="field"><span>质量风险</span><select value={relationshipFilters.risk} onChange={(event) => setRelationshipFilters((current) => ({ ...current, risk: event.target.value }))}><option value="all">全部风险</option><option value="passed">通过</option><option value="warning">待补齐</option><option value="critical">需处理</option></select></label>
          <span className="filter-result-count">命中 {filteredRelations.length} 条关系</span>
        </div>

        <div className="table-wrap">
          <table className="data-table compact sticky-actions relationship-table">
            <thead><tr><th>源实验</th><th>目标实验</th><th>关系类型</th><th>影响范围</th><th>关联原因</th><th>最近更新</th><th>质量风险</th><th>操作</th></tr></thead>
            <tbody>
              {filteredRelations.map((record) => {
                const source = experiments.find((item) => item.id === record.sourceExperimentId);
                const target = experiments.find((item) => item.id === record.targetExperimentId);
                return <tr key={record.id}>
                  <td><button type="button" className="table-link" onClick={() => openDetail(source ?? null)}>{source?.name ?? record.sourceExperimentId}</button><span className="mono">{record.sourceExperimentId}</span></td>
                  <td><button type="button" className="table-link" onClick={() => target && setFocusedRelationshipId(target.id)}>{target?.name ?? record.targetExperimentId}</button><span className="mono">{record.targetExperimentId}</span></td>
                  <td>{record.type}</td><td>{record.scope}</td><td>{record.reason}</td><td>{record.updatedAt}</td>
                  <td><span className={`quality-badge ${record.risk}`}>{qualityText[record.risk]}</span></td>
                  <td><div className="row-actions"><button type="button" onClick={() => openDetail(source ?? null)}>查看详情</button>{record.risk !== "passed" ? <button type="button" onClick={() => focusExperimentInvestigation(record.sourceExperimentId, "lineage", "relationship", "relationship")}>以源实验加入排查</button> : null}</div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <Panel title="关系变更记录">
          <div className="relationship-change-log">
            {focusedChangeEvents.map((change) => {
              const record = relationRecords.find((item) => item.id === change.relationshipId);
              return <div key={change.id}>
                <span>{change.time} · {change.operator}</span>
                <strong>{change.action}关系</strong>
                <p>{change.reason}</p>
                <p>{change.fieldDelta}</p>
                {record ? <button type="button" className="link-button" onClick={() => setFocusedRelationshipId(record.sourceExperimentId === focusedExperiment.id ? record.targetExperimentId : record.sourceExperimentId)}>聚焦关联实验</button> : null}
              </div>
            })}
            {!focusedChangeEvents.length ? <p className="relationship-empty">当前实验没有关系变更记录。</p> : null}
          </div>
        </Panel>
      </section>
    );
  }

  function renderLineage() {
    return renderLineageWorkbench();
  }

  function renderRolloutWorkbench() {
    const rolloutSource = focusedRolloutExperiment ? [focusedRolloutExperiment] : experiments;
    const rolloutRows = rolloutSource
      .flatMap((item) => item.rolloutEvents.map((event) => ({ ...event, experimentId: item.id, experimentName: item.name, sourcePlatform: event.sourcePlatform || item.sourcePlatform })))
      .filter((row) => {
        const keyword = rolloutFilters.keyword.trim().toLowerCase();
        return (!keyword || [row.experimentId, row.experimentName, row.operator, row.reason, row.sourcePlatform].join(" ").toLowerCase().includes(keyword))
          && (rolloutFilters.action === "all" || row.type === rolloutFilters.action)
          && (rolloutFilters.operator === "all" || row.operator === rolloutFilters.operator)
          && (!rolloutFilters.dateFrom || row.time.slice(0, 10) >= rolloutFilters.dateFrom)
          && (!rolloutFilters.dateTo || row.time.slice(0, 10) <= rolloutFilters.dateTo);
      })
      .sort((left, right) => right.time.localeCompare(left.time));
    const focusLabel = focusedRolloutExperiment ? `${focusedRolloutExperiment.id} · ${focusedRolloutExperiment.name}` : "全部实验";

    return (
      <section className="module-page rollout-workbench" data-page-id="rollout">
        <div className="page-heading">
          <div><h1>放量历史</h1><p>按时间回看放量变化，并把无原因、人工补录和异常窗口直接带入当前排查。</p></div>
          <div className="page-heading-actions">
            {focusedRolloutExperiment ? <button className="ghost-button" type="button" onClick={() => { setFocusedRolloutId(null); setRolloutScope("all"); showToast("已切回全部放量历史"); }}>返回全部放量</button> : null}
            {!focusedRolloutExperiment && investigationContext ? <button className="primary-button" type="button" onClick={() => { setRolloutScope("context"); showToast("已聚焦当前排查实验"); }}>聚焦当前实验</button> : null}
          </div>
        </div>

        <div className="rollout-focus-bar">
          <strong>{focusedRolloutExperiment ? "聚焦模式" : "全局模式"}</strong>
          <span>{focusLabel}</span>
          <span>命中 {rolloutRows.length} 条放量事件</span>
          {investigationContext ? <span>排查范围：近 {investigationContext.timeRange.replace("d", " 天")}</span> : null}
        </div>

        <div className="filter-grid slim-filter rollout-filter-grid">
          <label className="field"><span>实验 / 原因</span><input value={rolloutFilters.keyword} onChange={(event) => setRolloutFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="实验 ID、名称、原因" /></label>
          <label className="field"><span>动作</span><select value={rolloutFilters.action} onChange={(event) => setRolloutFilters((current) => ({ ...current, action: event.target.value }))}><option value="all">全部动作</option><option>启动</option><option>放量</option><option>暂停</option><option>结束</option></select></label>
          <label className="field"><span>操作人</span><select value={rolloutFilters.operator} onChange={(event) => setRolloutFilters((current) => ({ ...current, operator: event.target.value }))}><option value="all">全部操作人</option>{Array.from(new Set(experiments.flatMap((item) => item.rolloutEvents.map((event) => event.operator)))).map((operator) => <option key={operator}>{operator}</option>)}</select></label>
          <label className="field"><span>开始日期</span><input type="date" value={rolloutFilters.dateFrom} onChange={(event) => setRolloutFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
          <label className="field"><span>结束日期</span><input type="date" value={rolloutFilters.dateTo} onChange={(event) => setRolloutFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        </div>

        <section className="rollout-timeline" aria-label="放量时间线" data-page-core="rollout-timeline">
          <div className="rollout-timeline-heading"><h2>放量时间线</h2><span>最新 {Math.min(rolloutRows.length, 6)} 条</span></div>
          {rolloutRows.slice(0, 6).map((event) => {
            const experiment = experiments.find((item) => item.id === event.experimentId);
            const riskReasons = getRolloutRiskReasons(experiment?.rolloutEvents ?? [], event);
            const isRisk = riskReasons.length > 0;
            return <article className={`rollout-timeline-event ${isRisk ? "risk" : ""}`} data-rollout-event={`${event.experimentId}:${event.time}`} key={`timeline-${event.experimentId}-${event.time}`}>
              <time>{event.time}</time>
              <div className="rollout-change"><strong>{event.from} → {event.to}</strong><span>{event.type}</span></div>
              <div><strong>{event.experimentName}</strong><span>{event.sourcePlatform} · {event.operator}</span></div>
              <div className="rollout-reason"><strong>{event.reason || "原因缺失"}</strong>{isRisk ? <span className="risk-reasons">{riskReasons.join("；")}</span> : <span>原因完整</span>}</div>
              <div className="row-actions">
                <button type="button" onClick={() => openDetail(experiments.find((item) => item.id === event.experimentId) ?? null)}>详情</button>
                {isRisk ? <button type="button" onClick={() => {
                  if (investigationContext?.caseId && investigationContext.experimentId === event.experimentId) {
                    navigateWithInvestigation("rollout", "rollout");
                  } else {
                    startInvestigation(event.experimentId, { tab: "rollout", entrySource: "rollout", focus: "rollout" });
                  }
                }}>加入排查</button> : null}
              </div>
            </article>;
          })}
          {!rolloutRows.length ? <p className="timeline-empty">当前筛选范围没有放量事件。</p> : null}
        </section>

        <div className="table-wrap rollout-table-wrap">
          <table className="data-table compact rollout-table">
            <thead><tr><th>时间</th><th>实验</th><th>动作</th><th>放量变化</th><th>操作人</th><th>来源平台</th><th>原因</th><th>排查</th></tr></thead>
            <tbody>{rolloutRows.map((event) => {
              const experiment = experiments.find((item) => item.id === event.experimentId);
              const riskReasons = getRolloutRiskReasons(experiment?.rolloutEvents ?? [], event);
              return <tr key={`${event.experimentId}-${event.time}`}><td>{event.time}</td><td><button type="button" className="table-link" onClick={() => openDetail(experiment ?? null)}>{event.experimentName}</button><span className="mono">{event.experimentId}</span></td><td>{event.type}</td><td>{event.from} → {event.to}</td><td>{event.operator}</td><td>{event.sourcePlatform}</td><td>{event.reason || "原因缺失"}{riskReasons.length ? <span className="risk-reasons">{riskReasons.join("；")}</span> : null}</td><td>{riskReasons.length ? <button type="button" className="link-button" onClick={() => focusExperimentInvestigation(event.experimentId, "rollout", "rollout", "rollout")}>加入排查</button> : <span className="muted-text">-</span>}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderRollout() {
    return renderRolloutWorkbench();
  }

  function renderRolloutFilters() {
    return (
      <div className="filter-grid slim-filter">
        <label className="field">
          <span>实验 / 原因</span>
          <input value={rolloutFilters.keyword} onChange={(event) => setRolloutFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="实验 ID / 名称 / 原因" />
        </label>
        <label className="field">
          <span>动作类型</span>
          <select value={rolloutFilters.action} onChange={(event) => setRolloutFilters((current) => ({ ...current, action: event.target.value }))}>
            <option value="all">全部动作</option>
            <option>启动</option>
            <option>放量</option>
            <option>暂停</option>
            <option>结束</option>
          </select>
        </label>
        <label className="field">
          <span>操作人</span>
          <select value={rolloutFilters.operator} onChange={(event) => setRolloutFilters((current) => ({ ...current, operator: event.target.value }))}>
            <option value="all">全部操作人</option>
            <option>赵晨</option>
            <option>李维</option>
            <option>陈露</option>
            <option>周一帆</option>
            <option>吴雅</option>
            <option>刘昕</option>
          </select>
        </label>
        <label className="field">
          <span>开始时间</span>
          <input type="date" value={rolloutFilters.dateFrom} onChange={(event) => setRolloutFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
        </label>
        <label className="field">
          <span>结束时间</span>
          <input type="date" value={rolloutFilters.dateTo} onChange={(event) => setRolloutFilters((current) => ({ ...current, dateTo: event.target.value }))} />
        </label>
      </div>
    );
  }

  function renderSeedTool() {
    const domainExperiment = experiments.find((item) => item.businessLine === sampleScope.domain) ?? selectedCheckExperiment;
    const candidateSplitRows = seedCandidates.map((candidate, index) => ({
      ...candidate,
      trafficLayer: index % 2 === 0 ? domainExperiment.trafficLayer : activeSplitPlan.trafficLayer,
      splitRatio: index % 3 === 0 ? "50 / 50" : index % 3 === 1 ? "80 / 20" : "90 / 10",
      sampleScope: `${sampleScope.domain} · ${sampleScope.source} · ${sampleScope.window}`,
      unit: sampleScope.unit,
      reuseRisk: (candidate.conflictRisk >= 8 ? "critical" : candidate.conflictRisk >= 4 ? "warning" : "passed") as QualityStatus,
      namingStatus: candidate.seed.length >= 4 && candidate.seed.length <= 64 ? "规范" : "需调整",
      layerOccupancy: index % 3 === 0 ? "2 个运行实验" : index % 3 === 1 ? "1 个运行实验" : "当前空闲",
    }));
    return (
      <section className="module-page" data-page-id="seed">
        <div className="page-heading">
          <h1>分流方案</h1>
          <p>统一登记 Seed、分流层、比例、实验单位和样本口径；统计校验集中到上线前检查。</p>
        </div>
        <div className="module-grid seed-workbench" data-page-core="traffic-split-evaluation">
          <Panel title="生成与登记">
            <div className="segmented three">
              {[
                ["manual", "手动 seed 列表"],
                ["template", "模板变量"],
                ["random", "随机生成"],
              ].map(([value, label]) => (
                <button key={value} type="button" className={seedInputMode === value ? "active" : ""} aria-pressed={seedInputMode === value} onClick={() => setSeedInputMode(value as SeedInputMode)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              {seedInputMode === "manual" ? (
                <label className="field vertical wide-field">
                  <span>手动 seed 列表</span>
                  <textarea value={seedManualList} onChange={(event) => setSeedManualList(event.target.value)} rows={5} />
                </label>
              ) : null}
              {seedInputMode === "template" ? (
                <>
                  <label className="field vertical">
                    <span>模板</span>
                    <input value={seedTemplate} onChange={(event) => setSeedTemplate(event.target.value)} />
                  </label>
                  <label className="field vertical wide-field">
                    <span>模板变量</span>
                    <textarea value={seedTemplateVars} onChange={(event) => setSeedTemplateVars(event.target.value)} rows={5} />
                  </label>
                </>
              ) : null}
              {seedInputMode === "random" ? (
                <label className="field vertical">
                  <span>分流层 / 命名空间</span>
                  <input value={seedBase} onChange={(event) => setSeedBase(event.target.value)} />
                </label>
              ) : null}
              <label className="field vertical">
                <span>样本口径</span>
                <select value={sampleScope.unit} onChange={(event) => setSampleScope((current) => ({ ...current, unit: event.target.value }))}>
                  <option>用户</option>
                  <option>设备</option>
                  <option>订单</option>
                  <option>会话</option>
                </select>
              </label>
              <label className="field vertical">
                <span>候选数量</span>
                <input type="number" min={1} max={12} value={seedCount} onChange={(event) => setSeedCount(Number(event.target.value))} />
              </label>
            </div>
          </Panel>
          <Panel title="当前选择">
            <div className="result-card">
              <span>已选择 seed</span>
              <strong>{selectedSeed}</strong>
              <p>分流层：{activeSplitPlan.trafficLayer}；分流比例：{activeSplitPlan.splitRatio}；样本口径：{sampleScope.domain} · {sampleScope.unit}。</p>
              <p>{activeSplitPlan.selectedReason}</p>
            </div>
          </Panel>
        </div>
        <div className="table-wrap">
          <table className="data-table compact sticky-actions">
            <thead>
              <tr>
                <th>候选 seed</th>
                <th>分流层</th>
                <th>分流比例</th>
                <th>样本口径</th>
                <th>命名状态</th>
                <th>分流层占用</th>
                <th>历史复用风险</th>
                <th>建议</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {candidateSplitRows.map((item) => (
                <tr key={item.seed}>
                  <td className="mono">{item.seed}</td>
                  <td>{item.trafficLayer}</td>
                  <td>{item.splitRatio}</td>
                  <td>{item.sampleScope} · {item.unit}</td>
                  <td><span className={`quality-badge ${item.namingStatus === "规范" ? "passed" : "warning"}`}>{item.namingStatus}</span></td>
                  <td>{item.layerOccupancy}</td>
                  <td>
                    <span className={`quality-badge ${item.reuseRisk}`}>{qualityText[item.reuseRisk]}</span>
                  </td>
                  <td>
                    <span className={`quality-badge ${item.reuseRisk === "passed" ? "passed" : item.reuseRisk === "warning" ? "warning" : "critical"}`}>{item.reuseRisk === "passed" ? "可登记" : item.reuseRisk === "warning" ? "需复核" : "不建议"}</span>
                  </td>
                  <td>
                    <button className="link-button" onClick={() => { setSelectedSeed(item.seed); setCheckTarget((current) => ({ ...current, type: "候选 seed", seed: item.seed })); navigateToTab("check"); showToast("已带入上线前检查"); }}>
                      带入上线前检查
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Panel title="已登记分流方案">
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>实验</th>
                  <th>Seed</th>
                  <th>分流层</th>
                  <th>分流比例</th>
                  <th>样本口径</th>
                  <th>历史复用风险</th>
                  <th>选择原因</th>
                </tr>
              </thead>
              <tbody>
                {trafficSplitPlans.map((plan) => {
                  const experiment = experiments.find((item) => item.id === plan.experimentId);
                  return (
                    <tr key={plan.id}>
                      <td>{experiment?.name ?? plan.experimentId}</td>
                      <td className="mono">{plan.seed}</td>
                      <td>{plan.trafficLayer}</td>
                      <td>{plan.splitRatio}</td>
                      <td>{plan.sampleScope} · {plan.unit}</td>
                      <td>
                        <span className={`quality-badge ${plan.reuseRisk}`}>{qualityText[plan.reuseRisk]}</span>
                      </td>
                      <td>{plan.selectedReason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    );
  }

  function renderLegacyInvestigationWorkbench() {
    const problemTypes = Array.from(new Set(monitorAlerts.map((alert) => alert.type)));
    const filteredMonitorAlerts = monitorAlerts.filter((alert) => !monitorProblemTypes.length || monitorProblemTypes.includes(alert.type));
    const currentExperiment = investigationContext ? experiments.find((item) => item.id === investigationContext.experimentId) : null;
    const toggleProblemType = (type: string) => setMonitorProblemTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);

    return (
      <section className="module-page investigation-workbench" data-page-id="investigate">
        <div className="page-heading">
          <div><h1>运行中监控排查</h1><p>从异常告警建立本地排查，再连续查看关系、放量、校验和负责人。</p></div>
          <span className="quiet-badge">本地演示状态，不写入生产系统</span>
        </div>

        <div className="monitor-status-row" aria-label="监控状态摘要">
          <div><span>异常队列</span><strong>{monitorAlerts.length}</strong></div>
          <div><span>需立即处理</span><strong className="danger-text">{monitorAlerts.filter((item) => item.severity === "critical").length}</strong></div>
          <div><span>涉及负责人</span><strong>{new Set(monitorAlerts.map((item) => item.owner)).size}</strong></div>
          <div><span>当前排查</span><strong>{investigationContext?.caseId ? investigationContext.caseId : "未建立"}</strong></div>
        </div>

        <section className="monitor-filter-bar" aria-label="问题类型筛选">
          <div><strong>问题类型</strong><span>已选 {monitorProblemTypes.length} 项，命中 {filteredMonitorAlerts.length} 条</span></div>
          <div className="problem-type-options">
            {problemTypes.map((type) => <label key={type}><input type="checkbox" checked={monitorProblemTypes.includes(type)} onChange={() => toggleProblemType(type)} />{type}</label>)}
          </div>
        </section>

        <section className="monitor-queue" aria-label="异常队列" data-page-core="alert-queue">
          <div className="monitor-queue-heading"><h2>异常队列</h2><span>{filteredMonitorAlerts.length} 条待查看</span></div>
          <div className="monitor-queue-columns" aria-hidden="true"><span>严重度</span><span>实验与指标</span><span>最近变化</span><span>负责人</span><span>证据预览</span><span>操作</span></div>
          {filteredMonitorAlerts.map((alert) => {
            const experiment = experiments.find((item) => item.id === alert.experimentId);
            const isCurrent = investigationContext?.caseId && investigationContext.alertId === alert.id;
            return <article className={`monitor-alert-row ${alert.severity}`} key={alert.id}>
              <div><span className={`severity-badge ${alert.severity}`}>{alert.severity === "critical" ? "紧急" : alert.severity === "warning" ? "关注" : "提示"}</span></div>
              <div><button type="button" className="table-link" onClick={() => openDetail(experiment ?? null)}>{experiment?.name ?? alert.experimentId}</button><span>{alert.metric}</span></div>
              <div><strong>{alert.updatedAt}</strong><span>{experiment?.rollout ?? 0}% 放量 · {experiment?.status ? statusText[experiment.status] : ""}</span></div>
              <div>{alert.owner}</div>
              <div className="evidence-preview">{alert.evidence}</div>
              <div className="row-actions"><button type="button" onClick={() => openDetail(experiment ?? null)}>详情</button><button type="button" data-start-investigation={alert.experimentId} data-evidence-focus="metric" className={isCurrent ? "ghost-button" : "primary-button"} onClick={() => isCurrent ? navigateWithInvestigation("investigate", "metric") : startInvestigation(alert.experimentId, { alertId: alert.id, focus: "metric" })}>{isCurrent ? "继续排查" : "开始排查"}</button></div>
            </article>;
          })}
          {!filteredMonitorAlerts.length ? <p className="queue-empty">当前问题类型没有命中异常。取消筛选可查看全部告警。</p> : null}
        </section>

        <section className="current-investigation" aria-label="当前排查">
          <div className="current-investigation-heading"><div><h2>当前排查</h2><span>统一证据时间线</span></div>{investigationContext?.caseId ? <span className={`investigation-status ${investigationContext.status}`}>{investigationStatusText[investigationContext.status]}</span> : null}</div>
          {investigationContext?.caseId && currentExperiment ? <>
            <div className="current-investigation-summary"><strong>{currentExperiment.name}</strong><span>{investigationContext.caseId} · 近 {investigationContext.timeRange.replace("d", " 天")} · 负责人 {investigationContext.owner}</span></div>
            <div className="evidence-timeline">
              {evidenceTimeline.slice(0, 6).map((event) => <div className={`evidence-timeline-item ${event.severity}`} key={event.id}><time>{event.occurredAt}</time><div><strong>{event.title}</strong><p>{event.summary}</p><span>{event.sourcePlatform} · {event.operator}</span></div></div>)}
              {!evidenceTimeline.length ? <p className="timeline-empty">当前时间范围没有可用证据。</p> : null}
            </div>
            <div className="current-investigation-actions">
              <button type="button" className="primary-button" data-evidence-focus="relationship" onClick={() => navigateWithInvestigation("lineage", "relationship")}>查看关系</button>
              <button type="button" className="ghost-button" data-evidence-focus="rollout" onClick={() => navigateWithInvestigation("rollout", "rollout")}>查看放量</button>
              <button type="button" className="ghost-button" data-evidence-focus="validation" onClick={() => openDetail(currentExperiment)}>校验快照</button>
            </div>
          </> : <p className="current-investigation-empty">从异常队列或实验详情开始排查后，这里会连续展示同一实验的关系、放量、校验与告警证据。</p>}
        </section>
      </section>
    );
  }

  function renderInvestigationWorkbench() {
    const problemTypes = Array.from(new Set(monitorAlerts.map((alert) => alert.type)));
    const filteredMonitorAlerts = monitorAlerts.filter((alert) => !monitorProblemTypes.length || monitorProblemTypes.includes(alert.type));
    const selectedAlert = monitorAlerts.find((alert) => alert.id === selectedAlertId) ?? monitorAlerts[0];
    const targetExperiment = experiments.find((item) => item.id === selectedAlert.experimentId) ?? experiments[0];
    const actor: RuleActor = roleView === "admin" ? { role: "admin", name: "赵晨" } : { role: "experimentOwner", name: "赵晨" };
    const candidateInputs: AttributionCandidateRecord[] = experiments
      .filter((item) => item.id !== targetExperiment.id && item.status === "running")
      .map((item, index) => ({
        experimentId: item.id,
        name: item.name,
        owner: item.owner,
        sampleOverlap: [0.86, 0.63, 0.41, 0.28][index] ?? 0.25,
        rolloutAlignment: [0.92, 0.58, 0.47, 0.31][index] ?? 0.2,
        layerOverlap: item.trafficLayer === targetExperiment.trafficLayer ? 1 : [0.72, 0.5, 0.25][index] ?? 0.2,
        metricSync: [0.78, 0.66, 0.35, 0.22][index] ?? 0.2,
        registeredRelation: relationRecords.some((record) => [record.sourceExperimentId, record.targetExperimentId].includes(item.id) && [record.sourceExperimentId, record.targetExperimentId].includes(targetExperiment.id)) ? 1 : 0,
        visible: index !== 2,
        strategy: `${item.trafficLayer} · ${item.userGroup}`,
        metricDetail: `${item.coreMetric} 在告警窗口内同步变化`,
        rolloutChange: item.rolloutEvents.length ? `${item.rolloutEvents[item.rolloutEvents.length - 1].from} -> ${item.rolloutEvents[item.rolloutEvents.length - 1].to}` : `${item.rollout}%`,
        riskReason: item.trafficLayer === targetExperiment.trafficLayer ? "同分流层且样本窗口重叠" : "放量时间与指标变化吻合",
      }));
    const attributionResults = rankAttributionCandidates({ experimentId: targetExperiment.id }, candidateInputs) as unknown as Array<AttributionCandidateRecord & { score: number; evidence: Array<{ label: string; contribution: number }> }>;
    const selectedRule = alertRules.find((rule) => rule.id === selectedRuleId) ?? alertRules[0];
    const canEditSelectedRule = canManageRule(actor, selectedRule);

    const selectRule = (rule: AlertRuleRecord) => {
      setSelectedRuleId(rule.id);
      setRuleDraft({ ...rule, recipients: [...rule.recipients], audit: [...rule.audit] });
    };
    const saveRule = () => {
      if (!canManageRule(actor, ruleDraft)) return showToast("当前身份只能查看该规则");
      const validation = validateAlertRule(ruleDraft, { threshold: { min: -30, max: 30 }, consecutiveWindows: { min: 1, max: 6 } });
      if (!validation.valid) return showToast(validation.errors[0]);
      const next = { ...ruleDraft, version: ruleDraft.version + 1, audit: [...ruleDraft.audit, { id: `AUD-${Date.now()}`, actor: actor.name, action: "编辑规则", note: `阈值更新为 ${ruleDraft.threshold}`, occurredAt: "2026-08-21 10:30" }] };
      setAlertRules((current) => current.map((item) => item.id === next.id ? next : item));
      setRuleDraft(next);
      showToast("规则已保存并生成变更记录");
    };
    const toggleRule = (rule: AlertRuleRecord) => {
      try {
        const next = transitionAlertRule(rule, rule.status === "enabled" ? "disable" : "enable", actor, "监控工作台手动调整") as AlertRuleRecord;
        setAlertRules((current) => current.map((item) => item.id === rule.id ? next : item));
        if (selectedRuleId === rule.id) setRuleDraft(next);
        showToast(`规则已${next.status === "enabled" ? "启用" : "停用"}`);
      } catch {
        showToast("当前身份无权启停该规则");
      }
    };

    return (
      <section className="module-page investigation-workbench" data-page-id="investigate">
        <div className="page-heading"><div><h1>运行中监控排查</h1><p>集中处理告警、定位交叉实验影响，并维护实验级告警规则。</p></div><span className="quiet-badge">前端模拟 · 结果可交互</span></div>
        <div className="monitor-tabs" role="tablist" aria-label="监控排查视图">
          {([['alerts', '告警中心'], ['attribution', '异常归因'], ['rules', '规则配置']] as Array<[MonitorView, string]>).map(([value, label]) => <button key={value} type="button" role="tab" data-monitor-view={value} aria-selected={monitorView === value} className={monitorView === value ? "active" : ""} onClick={() => setMonitorView(value)}>{label}</button>)}
        </div>

        {monitorView === "alerts" ? <>
          <div className="monitor-status-row" aria-label="监控状态摘要"><div><span>异常队列</span><strong>{monitorAlerts.length}</strong></div><div><span>紧急告警</span><strong className="danger-text">{monitorAlerts.filter((item) => item.severity === "critical").length}</strong></div><div><span>启用规则</span><strong>{alertRules.filter((item) => item.status === "enabled").length}</strong></div><div><span>涉及负责人</span><strong>{new Set(monitorAlerts.map((item) => item.owner)).size}</strong></div></div>
          <section className="monitor-filter-bar" aria-label="问题类型筛选"><div><strong>问题类型</strong><span>命中 {filteredMonitorAlerts.length} 条</span></div><div className="problem-type-options">{problemTypes.map((type) => <label key={type}><input type="checkbox" checked={monitorProblemTypes.includes(type)} onChange={() => setMonitorProblemTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])} />{type}</label>)}</div></section>
          <section className="monitor-queue" aria-label="异常队列" data-page-core="alert-queue">
            <div className="monitor-queue-heading"><h2>异常队列</h2><span>上线后新增实验持续参与冲突扫描</span></div>
            {filteredMonitorAlerts.map((alert) => { const experiment = experiments.find((item) => item.id === alert.experimentId); return <article className={`monitor-alert-card ${alert.severity}`} key={alert.id}><div className="alert-card-head"><span className={`severity-badge ${alert.severity}`}>{alert.severity === "critical" ? "紧急" : "关注"}</span><strong>{experiment?.name}</strong><span>{alert.updatedAt}</span></div><div className="alert-card-body"><div><span>异常指标</span><strong>{alert.metric}</strong></div><p>{alert.evidence}</p><div><span>负责人</span><strong>{alert.owner}</strong></div></div><div className="row-actions"><button type="button" onClick={() => openDetail(experiment ?? null)}>详情</button><button type="button" data-start-investigation={alert.experimentId} onClick={() => startInvestigation(alert.experimentId, { alertId: alert.id, focus: "metric" })}>建立排查</button><button type="button" className="primary-button" onClick={() => { setSelectedAlertId(alert.id); setMonitorView("attribution"); }}>分析影响来源</button></div></article>; })}
          </section>
          {investigationContext?.caseId ? <section className="current-investigation"><div className="current-investigation-heading"><div><h2>当前排查</h2><span>{investigationContext.caseId} · {investigationContext.owner}</span></div><span className={`investigation-status ${investigationContext.status}`}>{investigationStatusText[investigationContext.status]}</span></div><div className="current-investigation-actions"><button type="button" className="primary-button" data-evidence-focus="relationship" onClick={() => navigateWithInvestigation("lineage", "relationship")}>查看关系</button><button type="button" className="ghost-button" data-evidence-focus="rollout" onClick={() => navigateWithInvestigation("rollout", "rollout")}>查看放量</button><button type="button" className="ghost-button" data-evidence-focus="validation" onClick={() => openDetail(targetExperiment)}>校验快照</button></div></section> : null}
        </> : null}

        {monitorView === "attribution" ? <section className="attribution-workbench" data-page-core="cross-experiment-attribution">
          <div className="attribution-summary"><div><span>目标实验</span><strong>{targetExperiment.name}</strong><p>{selectedAlert.metric} · {selectedAlert.evidence}</p></div><div><span>扫描范围</span><strong>全部运行实验</strong><p>{attributionResults.length} 个候选 · 按五类证据加权</p></div></div>
          <div className="notice-strip">关联嫌疑，不代表因果。建议结合放量、样本和业务规则由负责人复核。</div>
          <div className="attribution-list">{attributionResults.map((candidate, index) => <article key={candidate.experimentId} data-attribution-candidate={candidate.experimentId}><div className="attribution-rank"><span>#{index + 1}</span><strong>{candidate.score}</strong><em>嫌疑分</em></div><div className="attribution-main"><div><strong>{candidate.name}</strong><span className="mono">{candidate.experimentId}</span></div><p>{candidate.riskReason}</p><div className="evidence-score-row">{candidate.evidence.map((item) => <span key={item.label}>{item.label} +{item.contribution}</span>)}</div>{candidate.visible === false ? <em>受权限限制，策略与指标明细已隐藏</em> : <small>{candidate.strategy} · {candidate.metricDetail} · 放量 {candidate.rolloutChange}</small>}</div><div className="attribution-owner"><span>负责人</span><strong>{candidate.owner}</strong><button type="button" onClick={() => showToast(`已生成联系卡片：${candidate.owner}`)}>联系负责人</button></div></article>)}</div>
        </section> : null}

        {monitorView === "rules" ? <section className="rule-workbench" data-page-core="alert-rules">
          <div className="rule-list"><div className="rule-section-heading"><div><h2>告警规则</h2><p>管理员维护模板边界；实验负责人仅管理自己的实验规则。</p></div><span>{roleView === "admin" ? "管理员" : "实验负责人"}视角</span></div>{alertRules.map((rule) => <button type="button" key={rule.id} className={`rule-list-item ${selectedRuleId === rule.id ? "active" : ""}`} onClick={() => selectRule(rule)}><span className={`status-dot ${rule.status === "enabled" ? "running" : "paused"}`}><i />{rule.status === "enabled" ? "启用" : "停用"}</span><strong>{rule.name}</strong><small>{rule.metric} {rule.operator} {rule.threshold} · 连续 {rule.consecutiveWindows} 个周期</small><em>v{rule.version} · {rule.owner}</em></button>)}</div>
          <div className="rule-editor"><div className="rule-section-heading"><div><h2>规则配置</h2><p>{canEditSelectedRule ? "当前规则可编辑" : "当前规则只读"}</p></div><button type="button" onClick={() => toggleRule(selectedRule)}>{selectedRule.status === "enabled" ? "停用" : "启用"}</button></div><div className="form-grid"><label className="field vertical"><span>规则名称</span><input disabled={!canEditSelectedRule} value={ruleDraft.name} onChange={(event) => setRuleDraft((current) => ({ ...current, name: event.target.value }))} /></label><label className="field vertical"><span>指标</span><input disabled value={ruleDraft.metric} /></label><NumberField label="阈值" value={ruleDraft.threshold} onChange={(value) => setRuleDraft((current) => ({ ...current, threshold: value }))} /><NumberField label="连续周期" value={ruleDraft.consecutiveWindows} onChange={(value) => setRuleDraft((current) => ({ ...current, consecutiveWindows: value }))} /><label className="field vertical"><span>通知对象</span><input disabled={!canEditSelectedRule} value={ruleDraft.recipients.join("、")} onChange={(event) => setRuleDraft((current) => ({ ...current, recipients: event.target.value.split(/[、,]/).filter(Boolean) }))} /></label><label className="field vertical"><span>作用范围</span><input disabled value={ruleDraft.scope} /></label></div><div className="rule-editor-actions"><span>版本 v{ruleDraft.version} · 最近命中 {ruleDraft.lastHit}</span><button type="button" className="primary-button" disabled={!canEditSelectedRule} onClick={saveRule}>保存规则</button></div><h3>变更记录</h3><div className="rule-audit-list">{ruleDraft.audit.slice().reverse().map((event) => <div key={event.id}><strong>{event.action}</strong><span>{event.actor} · {event.occurredAt}</span><p>{event.note}</p></div>)}</div></div>
        </section> : null}
      </section>
    );
  }

  function renderInvestigation() {
    return renderInvestigationWorkbench();
  }

  function renderSeedHistory() {
    const rows = [
      { seed: "member-copy-v2", experiment: "会员权益文案强化", rollout: "5% -> 20%", time: "2026-06-17 11:30", result: "均匀性通过" },
      { seed: "search_empty_safe", experiment: "搜索无结果页改版", rollout: "20% -> 100%", time: "2026-06-21 12:20", result: "正交性通过" },
      { seed: "pay_coupon_holdout", experiment: "支付页优惠提醒", rollout: "10% -> 35%", time: "2026-06-19 10:00", result: "需复核" },
    ];
    return (
      <section className="module-page" data-page-id="seedHistory">
        <div className="page-heading">
          <h1>随机数放量历史</h1>
          <p>查看 seed 被哪些实验使用、何时放量、校验结论和是否存在复用风险。</p>
        </div>
        <div className="table-wrap" data-page-core="seed-rollout-history">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Seed</th>
                <th>实验</th>
                <th>放量变化</th>
                <th>时间</th>
                <th>评估结论</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.seed}-${row.time}`}>
                  <td className="mono">{row.seed}</td>
                  <td>{row.experiment}</td>
                  <td>{row.rollout}</td>
                  <td>{row.time}</td>
                  <td>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderMyImports() {
    return (
      <section className="module-page" data-page-id="myImports">
        <div className="page-heading">
          <h1>批量导入记录</h1>
          <p>普通用户查看自己提交的导入草稿、预检结果和管理员审核状态。</p>
        </div>
        <div className="table-wrap" data-page-core="import-history">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>批次</th>
                <th>文件</th>
                <th>预检</th>
                <th>审核状态</th>
                <th>提交人</th>
                <th>下一步</th>
              </tr>
            </thead>
            <tbody>
              {importBatches.map((batch) => (
                <tr key={batch.id}>
                  <td className="mono">{batch.id}</td>
                  <td>{batch.file}</td>
                  <td>{batch.summary}</td>
                  <td>{batch.status}</td>
                  <td>{batch.submitter}</td>
                  <td>{batch.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderImportReview() {
    return (
      <section className="module-page adminOnly">
        <div className="page-heading">
          <h1>批量导入审核</h1>
          <p>管理员处理字段映射、冲突记录、确认入库和失败行导出。</p>
        </div>
        <div className="module-grid two">
          <Panel title="待审核批次">
            {importBatches.map((batch) => (
              <div className="review-batch" key={batch.id}>
                <strong>{batch.id}</strong>
                <span>{batch.file} · {batch.summary}</span>
                <p>{batch.nextAction}</p>
              </div>
            ))}
          </Panel>
          <Panel title="审核动作">
            <div className="checklist">
              {reviewDecisions.map((decision) => (
                <span key={decision}>{decision}</span>
              ))}
            </div>
            <p className="hint">管理员按行处理阻断和需确认项；确认入库后写入实验清单，并保留审核记录。</p>
          </Panel>
        </div>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>批次</th>
                <th>行号</th>
                <th>实验 ID</th>
                <th>问题等级</th>
                <th>问题</th>
                <th>处理决策</th>
              </tr>
            </thead>
            <tbody>
              {importBatches.flatMap((batch) =>
                batch.issues.map((issue) => (
                  <tr key={`${batch.id}-${issue.row}`}>
                    <td className="mono">{batch.id}</td>
                    <td>{issue.row}</td>
                    <td className="mono">{issue.experimentId}</td>
                    <td>
                      <span className={`quality-badge ${issue.level === "通过" ? "passed" : issue.level === "需确认" ? "warning" : "critical"}`} aria-label={`导入批次 ${batch.id} 第 ${issue.row} 行状态：${issue.level}`}>{issue.level}</span>
                    </td>
                    <td>{issue.issue}</td>
                    <td>
                      <select defaultValue={issue.decision} aria-label={`导入批次 ${batch.id} 第 ${issue.row} 行的处理决策`}>
                        {reviewDecisions.map((decision) => (
                          <option key={decision}>{decision}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderGovernance() {
    return (
      <section className="module-page adminOnly">
        <div className="page-heading">
          <h1>数据治理</h1>
          <p>管理员维护来源平台、字段规则、记录可信度和校验阈值。</p>
        </div>
        <div className="module-grid three">
          <Panel title="治理规则">
            <div className="checklist">
              <span>必填字段完整</span>
              <span>来源平台命中生产登记名</span>
              <span>放量比例 0-100</span>
              <span>父实验必须存在</span>
            </div>
          </Panel>
          <Panel title="来源登记">
            <ul className="plain-list">
              <li>增长实验平台 · 平台接入 · 自动同步</li>
              <li>运营表格导入 · 表格导入 · 管理员审核</li>
              <li>手动补录 · 人工维护 · 需审计</li>
            </ul>
          </Panel>
          <Panel title="质量阈值">
            <ul className="plain-list">
              <li>Pre-AA p 值低于 0.05 标记需处理</li>
              <li>分桶偏差超过 1% 标记需复核</li>
              <li>互斥关系未确认时阻断入库</li>
            </ul>
          </Panel>
        </div>
      </section>
    );
  }

  function renderLegacyPermission() {
    const permissions = [
      { role: "普通用户", modules: "清单、关系、放量、校验、导入记录", actions: "查看、提交导入、运行校验" },
      { role: "实验负责人", modules: "普通用户模块 + 自己负责实验", actions: "编辑元数据、补充放量、维护关系" },
      { role: "管理员", modules: "全部模块", actions: "导入审核、治理规则、权限配置" },
    ];
    return (
      <section className="module-page adminOnly">
        <div className="page-heading">
          <h1>权限配置</h1>
          <p>管理员配置普通用户、治理用户和审计用户的可见模块与操作权限。</p>
        </div>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>角色</th>
                <th>可见模块</th>
                <th>允许操作</th>
                <th>权限矩阵</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((item) => (
                <tr key={item.role}>
                  <td>{item.role}</td>
                  <td>{item.modules}</td>
                  <td>{item.actions}</td>
                  <td>
                    <span className="quality-badge passed">已配置</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderPermission() {
    const activeProfile = permissionProfiles.find((item) => item.id === selectedPermissionRole) ?? permissionProfiles[0];
    const updateProfile = (patch: Partial<PermissionProfile>) => setPermissionProfiles((current) => current.map((item) => item.id === activeProfile.id ? { ...item, ...patch } : item));
    const savePermission = () => {
      setPermissionAudit((current) => [{ id: `PERM-AUD-${Date.now()}`, time: "2026-08-21 10:35", actor: "赵晨", target: activeProfile.name, action: `可见范围更新为：${activeProfile.visibility}` }, ...current]);
      showToast("权限档案已保存并记录审计");
    };
    return <section className="module-page adminOnly permission-workbench" data-page-id="permission">
      <div className="page-heading"><div><h1>权限管理</h1><p>按角色维护模块、动作、可见范围和负责人，普通用户主导航不暴露此入口。</p></div><button type="button" className="primary-button" onClick={savePermission}>保存权限档案</button></div>
      <div className="permission-layout" data-page-core="role-permission-profiles">
        <aside className="permission-role-list"><h2>角色档案</h2>{permissionProfiles.map((profile) => <button type="button" key={profile.id} className={selectedPermissionRole === profile.id ? "active" : ""} onClick={() => setSelectedPermissionRole(profile.id)}><strong>{profile.name}</strong><span>{profile.description}</span></button>)}</aside>
        <div className="permission-editor">
          <div className="permission-profile-head"><div><span>当前角色</span><h2>{activeProfile.name}</h2><p>{activeProfile.description}</p></div><span className="quality-badge passed">已启用</span></div>
          <div className="module-grid two">
            <Panel title="可见范围"><label className="field vertical"><span>业务域 / 实验范围</span><select value={activeProfile.visibility} onChange={(event) => updateProfile({ visibility: event.target.value })}><option>全部业务域与实验</option><option>所属业务域</option><option>负责与协作实验</option><option>授权业务域</option><option>显式授权实验</option></select></label><p className="hint">越出范围的归因候选只展示实验 ID、风险和负责人。</p></Panel>
            <Panel title="负责人"><div className="form-grid"><label className="field vertical"><span>角色负责人</span><input value={activeProfile.responsibleOwner} onChange={(event) => updateProfile({ responsibleOwner: event.target.value })} /></label><label className="field vertical"><span>代理负责人</span><input value={activeProfile.backupOwner} onChange={(event) => updateProfile({ backupOwner: event.target.value })} /></label></div></Panel>
          </div>
          <div className="permission-matrix"><section><h3>模块权限</h3>{["新增实验", "监控排查", "实验管理", "管理后台"].map((module) => <label key={module}><input type="checkbox" checked={activeProfile.modules.includes("全部模块") || activeProfile.modules.includes(module)} onChange={() => { const base = activeProfile.modules.filter((item) => item !== "全部模块"); updateProfile({ modules: base.includes(module) ? base.filter((item) => item !== module) : [...base, module] }); }} />{module}</label>)}</section><section><h3>动作权限</h3>{["查看", "编辑", "启停自己规则", "审核", "授权"].map((action) => <label key={action}><input type="checkbox" checked={activeProfile.actions.includes(action)} onChange={() => updateProfile({ actions: activeProfile.actions.includes(action) ? activeProfile.actions.filter((item) => item !== action) : [...activeProfile.actions, action] })} />{action}</label>)}</section></div>
          <Panel title="规则阈值范围"><label className="field vertical"><span>规则调整边界</span><select value={activeProfile.ruleThresholdRange} onChange={(event) => updateProfile({ ruleThresholdRange: event.target.value })}><option>可维护模板上下限</option><option>模板范围内调整</option><option>只读</option></select></label></Panel>
        </div>
      </div>
      <Panel title="权限变更记录"><div className="permission-audit-list">{permissionAudit.map((event) => <div key={event.id}><strong>{event.target}</strong><span>{event.action}</span><em>{event.actor} · {event.time}</em></div>)}</div></Panel>
    </section>;
  }

  function renderSampleTool() {
    return (
      <section className="module-page">
        <div className="page-heading">
          <h1>样本量计算</h1>
          <p>基于基线转化率、最小可检测提升、置信度、功效和每日流量估算实验周期。</p>
        </div>
        <div className="module-grid">
          <Panel title="输入参数">
            <div className="form-grid">
              <NumberField label="基线转化率 %" value={sampleInput.baseline} onChange={(value) => setSampleInput((current) => ({ ...current, baseline: value }))} />
              <NumberField label="MDE 百分点" value={sampleInput.mde} onChange={(value) => setSampleInput((current) => ({ ...current, mde: value }))} />
              <NumberField label="置信度 %" value={sampleInput.confidence} onChange={(value) => setSampleInput((current) => ({ ...current, confidence: value }))} />
              <NumberField label="统计功效 %" value={sampleInput.power} onChange={(value) => setSampleInput((current) => ({ ...current, power: value }))} />
              <NumberField label="实验组数" value={sampleInput.groups} onChange={(value) => setSampleInput((current) => ({ ...current, groups: value }))} />
              <NumberField label="每日可用样本" value={sampleInput.dailyTraffic} onChange={(value) => setSampleInput((current) => ({ ...current, dailyTraffic: value }))} />
            </div>
          </Panel>
          <Panel title="计算结果">
            <div className="result-grid">
              <Metric label="每组样本量" value={formatNumber(sampleResult.perGroup)} />
              <Metric label="总样本量" value={formatNumber(sampleResult.total)} />
              <Metric label="预计实验周期" value={`${sampleResult.days} 天`} tone={sampleResult.days > 14 ? "warning" : "success"} />
            </div>
            <p className="hint">公式使用双侧比例检验近似；生产实现需补充连续指标、方差输入和多重检验校正。</p>
          </Panel>
        </div>
      </section>
    );
  }

  function renderTestTool() {
    const conflictRelations = relationRecords.filter(
      (record) =>
        (record.sourceExperimentId === selectedCheckExperiment.id || record.targetExperimentId === selectedCheckExperiment.id) &&
        record.risk !== "passed",
    );
    const conflictPassed = conflictRelations.length === 0;
    const scopedExperiments = experiments.filter((item) => item.status === "running" && item.id !== selectedCheckExperiment.id).filter((item) => {
      if (checkScope === "全部运行实验") return true;
      if (checkScope === "同业务域") return item.businessLine === selectedCheckExperiment.businessLine;
      if (checkScope === "同分流层") return item.trafficLayer === selectedCheckExperiment.trafficLayer;
      return manualCheckExperiments.includes(item.id);
    });
    return (
      <section className="module-page" data-page-id="check">
        <div className="page-heading">
          <div>
            <h1>上线前检查</h1>
            <p>承接原实验校验能力，选择当前实验、候选 seed 或批量 seed 后，统一刷新 Pre-AA、均匀性、正交性和规则冲突检查。</p>
          </div>
          <button className="ghost-button help-button" onClick={() => openDrawer("help")}>
            <HelpCircle size={16} /> 检验帮助
          </button>
        </div>
        <div className="target-summary">
          <strong>当前检验针对：{activeCheckTarget}</strong>
          <span>
            {sampleScope.domain}业务域样本 · {sampleScope.source} · {sampleScope.window} · 实验单位：{sampleScope.unit} · 检查项已基于当前对象刷新
          </span>
        </div>
        <section className="check-scope-bar" aria-label="校验范围">
          <div><strong>校验范围</strong><span>范围内实验 {scopedExperiments.length} 个</span></div>
          <div className="segmented four">{(["全部运行实验", "同业务域", "同分流层", "手动指定"] as CheckScopeMode[]).map((scope) => <button type="button" key={scope} aria-pressed={checkScope === scope} className={checkScope === scope ? "active" : ""} onClick={() => setCheckScope(scope)}>{scope}</button>)}</div>
          {checkScope === "手动指定" ? <div className="manual-scope-list">{experiments.filter((item) => item.status === "running" && item.id !== selectedCheckExperiment.id).map((item) => <label key={item.id}><input type="checkbox" checked={manualCheckExperiments.includes(item.id)} onChange={() => setManualCheckExperiments((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />{item.name}</label>)}</div> : <div className="scope-experiment-summary">{scopedExperiments.length ? scopedExperiments.map((item) => <span key={item.id}>{item.name} · {item.trafficLayer}</span>) : <span>当前范围没有其他运行实验</span>}</div>}
        </section>
        <div className="context-grid">
          <Panel title="检验对象">
            <div className="form-grid">
              <label className="field vertical">
                <span>对象类型</span>
                <select value={checkTarget.type} onChange={(event) => setCheckTarget((current) => ({ ...current, type: event.target.value as CheckTargetType }))}>
                  <option>当前实验</option>
                  <option>候选 seed</option>
                  <option>批量 seed</option>
                </select>
              </label>
              <label className="field vertical">
                <span>实验 / seed</span>
                <select value={checkTarget.experimentId} onChange={(event) => setCheckTarget((current) => ({ ...current, experimentId: event.target.value }))}>
                  {experiments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="target-footer">
              <p className="hint">Pre-AA 和均匀性优先绑定当前实验或候选 seed；结果应回写到实验详情，方便上线前复核。</p>
              <button className="primary-button" type="button" onClick={applyCheckTarget}>
                <PlayCircle size={16} /> 刷新检查项
              </button>
            </div>
          </Panel>
          <Panel title="样本口径">
            <div className="form-grid scope-grid">
              <label className="field vertical">
                <span>业务域样本</span>
                <select value={sampleScope.domain} onChange={(event) => setSampleScope((current) => ({ ...current, domain: event.target.value }))}>
                  <option>增长</option>
                  <option>会员</option>
                  <option>推荐</option>
                  <option>交易</option>
                  <option>搜索</option>
                </select>
              </label>
              <label className="field vertical">
                <span>样本来源</span>
                <select value={sampleScope.source} onChange={(event) => setSampleScope((current) => ({ ...current, source: event.target.value }))}>
                  <option>历史 A/A</option>
                  <option>当前分流日志</option>
                  <option>离线人群包</option>
                  <option>上传样本</option>
                </select>
              </label>
              <label className="field vertical">
                <span>时间窗口</span>
                <select value={sampleScope.window} onChange={(event) => setSampleScope((current) => ({ ...current, window: event.target.value }))}>
                  <option>近 7 天</option>
                  <option>近 14 天</option>
                  <option>近 30 天</option>
                  <option>自定义</option>
                </select>
              </label>
              <label className="field vertical">
                <span>实验单位</span>
                <select value={sampleScope.unit} onChange={(event) => setSampleScope((current) => ({ ...current, unit: event.target.value }))}>
                  <option>用户</option>
                  <option>设备</option>
                  <option>订单</option>
                  <option>会话</option>
                </select>
              </label>
            </div>
          </Panel>
        </div>
        <Panel title="上线前检查单">
          <div className="validation-list" data-page-core="validation-checklist">
            {activeValidationChecklist.items.map((item) => (
              <div className={`validation-item ${item.status}`} key={item.name}>
                <span>{item.name}</span>
                <strong>{qualityText[item.status]}</strong>
                <p>{item.detail}</p>
                <em>{item.evidence}</em>
              </div>
            ))}
          </div>
        </Panel>
        <div className="module-grid three validation-grid">
          <Panel title="Pre-AA 检验（实验前历史 A/A）">
            <div className="form-grid one">
              <NumberField label="历史 A/A 对照率 %" value={preAAInput.control} onChange={(value) => setPreAAInput((current) => ({ ...current, control: value }))} />
              <NumberField label="历史 A/A 实验率 %" value={preAAInput.variant} onChange={(value) => setPreAAInput((current) => ({ ...current, variant: value }))} />
              <NumberField label="单组样本量" value={preAAInput.sample} onChange={(value) => setPreAAInput((current) => ({ ...current, sample: value }))} />
            </div>
            <CheckResult
              passed={preAAResult.passed}
              main={`Pre-AA p = ${preAAResult.pValue.toFixed(4)}`}
              detail={`当前检验针对 ${activeCheckTarget}；z = ${preAAResult.z.toFixed(2)}，${preAAResult.passed ? "历史 A/A 未见显著差异" : "历史 A/A 存在显著差异"}`}
            />
          </Panel>
          <Panel title="均匀性检验">
            <div className="form-grid one">
              <NumberField label="A 桶人数" value={uniformInput.a} onChange={(value) => setUniformInput((current) => ({ ...current, a: value }))} />
              <NumberField label="B 桶人数" value={uniformInput.b} onChange={(value) => setUniformInput((current) => ({ ...current, b: value }))} />
              <NumberField label="目标分流 %" value={uniformInput.split} onChange={(value) => setUniformInput((current) => ({ ...current, split: value }))} />
            </div>
            <CheckResult passed={uniformResult.passed} main={`分桶偏差 ${uniformResult.deviation.toFixed(2)}%`} detail={`chi-square = ${uniformResult.chi.toFixed(2)}，p = ${uniformResult.pValue.toFixed(4)}`} />
          </Panel>
          <Panel title="正交性检验">
            <div className="segmented">
              {(["当前运行实验", "批量 seed"] as OrthogonalityMode[]).map((mode) => (
                <button key={mode} type="button" className={orthMode === mode ? "active" : ""} aria-pressed={orthMode === mode} onClick={() => setOrthMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
            <p className="hint">{orthMode === "当前运行实验" ? "将目标实验与当前运行实验做交叉分布分析，优先发现流量层或人群重叠。" : "对候选 seed 两两分析，辅助选择更稳的分流种子。"}</p>
            <div className="matrix-grid">
              {orthInput.map((value, index) => (
                <input
                  key={index}
                  type="number"
                  value={value}
                  aria-label={`交叉分布单元 ${index + 1}`}
                  onChange={(event) =>
                    setOrthInput((current) => {
                      const next = [...current] as [number, number, number, number];
                      next[index] = Number(event.target.value);
                      return next;
                    })
                  }
                />
              ))}
            </div>
            <CheckResult passed={orthResult.passed} main={`交叉分布 p = ${orthResult.pValue.toFixed(4)}`} detail={`chi-square = ${orthResult.chi.toFixed(2)}，${orthResult.passed ? "未发现显著相关" : "存在流量相关风险"}`} />
          </Panel>
          <Panel title="规则冲突">
            <div className="conflict-box">
              <strong>{conflictPassed ? "未命中阻断规则" : `命中 ${conflictRelations.length} 条需处理关系`}</strong>
              <span>优先对比当前运行实验、同业务域实验、同分流层和同样本口径实验。</span>
            </div>
            {conflictRelations.length ? (
              <div className="risk-queue compact-risk-queue">
                {conflictRelations.map((record) => (
                  <button key={record.id} type="button" onClick={() => navigateToTab("lineage")}>
                    <strong>{record.type}</strong>
                    <span>{record.sourceExperimentId} {"->"} {record.targetExperimentId}</span>
                    <em>{record.scope}</em>
                  </button>
                ))}
              </div>
            ) : (
              <CheckResult passed main="规则冲突通过" detail={`${selectedCheckExperiment.trafficLayer} 暂未发现同层互斥或高风险父子关系。`} />
            )}
          </Panel>
        </div>
      </section>
    );
  }

  function renderConflict() {
    return (
      <section className="module-page">
        <div className="page-heading">
          <h1>冲突排查</h1>
          <p>按流量层、人群、核心指标、父子关系和放量时间快速定位可能互相影响的实验。</p>
        </div>
        <div className="module-grid two">
          <Panel title="疑似冲突">
            <ul className="plain-list">
              <li>推荐位排序策略：与搜索召回策略共享活跃用户池，建议查看正交性检验。</li>
              <li>会员权益文案强化：父实验正在 60% 放量，子实验指标反转需要同步解释。</li>
              <li>支付页优惠提醒：优惠成本上升，需结合放量历史判断是否由并行实验造成。</li>
            </ul>
          </Panel>
          <Panel title="排查维度">
            <div className="checklist">
              <span>同流量层</span>
              <span>同目标人群</span>
              <span>核心指标重叠</span>
              <span>时间窗口重叠</span>
              <span>父子实验关联</span>
            </div>
          </Panel>
        </div>
      </section>
    );
  }

  function renderSimplePage(title: string, description: string) {
    return (
      <section className="module-page">
        <div className="page-heading">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="empty-state">
          <CheckCircle2 size={28} />
          <strong>{title}配置入口</strong>
          <span>这里保留扩展入口，后续接入真实配置与任务状态。</span>
        </div>
      </section>
    );
  }
}

function Metric({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "success" | "warning" | "danger" }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tool-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field vertical">
      <span>{label}</span>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function CheckResult({ passed, main, detail }: { passed: boolean; main: string; detail: string }) {
  return (
    <div className={`check-result ${passed ? "passed" : "critical"}`}>
      <strong>{main}</strong>
      <span>{detail}</span>
    </div>
  );
}

export { App };
export default App;
