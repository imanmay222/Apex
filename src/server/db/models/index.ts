export * from "./admin-user";
export * from "./session";
export * from "./enquiry";
export * from "./order";
export * from "./product";
export * from "./product-group";
export * from "./survey";
export * from "./training";
export * from "./gallery";
export * from "./testimonial";
export * from "./logo";
export * from "./leader";
export * from "./subscriber";
export * from "./site-settings";
export * from "./infra";

import { AdminUserModel } from "./admin-user";
import { SessionModel } from "./session";
import { EnquiryModel } from "./enquiry";
import { OrderModel } from "./order";
import { ProductModel } from "./product";
import { ProductGroupModel } from "./product-group";
import { SurveyModel } from "./survey";
import { TrainingModel } from "./training";
import { GalleryModel } from "./gallery";
import { TestimonialModel } from "./testimonial";
import { LogoModel } from "./logo";
import { LeaderModel } from "./leader";
import { SubscriberModel } from "./subscriber";
import { SiteSettingsModel } from "./site-settings";
import { AnalyticsModel, AuditModel, CounterModel, RateLimitModel } from "./infra";

export const allModels = [
  AdminUserModel,
  SessionModel,
  EnquiryModel,
  OrderModel,
  ProductModel,
  ProductGroupModel,
  SurveyModel,
  TrainingModel,
  GalleryModel,
  TestimonialModel,
  LogoModel,
  LeaderModel,
  SubscriberModel,
  SiteSettingsModel,
  CounterModel,
  RateLimitModel,
  AuditModel,
  AnalyticsModel,
];
