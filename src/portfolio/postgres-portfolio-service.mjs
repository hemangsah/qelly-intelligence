import { PortfolioService } from './portfolio-service.mjs';

export class PostgresPortfolioService{
  constructor({repository,analytics=new PortfolioService()}={}){if(!repository)throw new Error('PostgreSQL repository is required');this.repository=repository;this.analytics=analytics;}
  async record(scope){const items=await this.repository.listPortfolios(scope);const record=items[0];if(!record)throw Object.assign(new Error('Portfolio not found'),{status:404,code:'portfolio_not_found'});return record;}
  async overview(scope){const [record,analytics]=await Promise.all([this.record(scope),Promise.resolve(this.analytics.overview())]);return {...analytics,portfolioId:record.portfolio_id,name:record.name,baseCurrency:record.base_currency,cashValue:Number(record.cash_value),persistedPositionCount:record.positions.length,persistence:'postgresql',tenantId:record.tenant_id,workspaceId:record.workspace_id};}
  async holdings(scope){const [record,analytics]=await Promise.all([this.record(scope),Promise.resolve(this.analytics.holdings())]);return {...analytics,portfolioId:record.portfolio_id,persistedPositionCount:record.positions.length,persistence:'postgresql'};}
  async performance(scope,options={}){const [record,analytics]=await Promise.all([this.record(scope),Promise.resolve(this.analytics.performance(options))]);return {...analytics,portfolioId:record.portfolio_id,persistence:'postgresql'};}
  async risk(scope){const [record,analytics]=await Promise.all([this.record(scope),Promise.resolve(this.analytics.risk())]);return {...analytics,portfolioId:record.portfolio_id,persistence:'postgresql'};}
  async attribution(scope,options={}){const [record,analytics]=await Promise.all([this.record(scope),Promise.resolve(this.analytics.attribution(options))]);return {...analytics,portfolioId:record.portfolio_id,persistence:'postgresql'};}
}
