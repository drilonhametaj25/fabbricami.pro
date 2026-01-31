"use strict";
// Shared Types and Constants
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = exports.API_VERSION = exports.OrderStatus = exports.InventoryLocation = exports.ProductType = exports.UserRole = void 0;
// User Roles
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["CONTABILE"] = "CONTABILE";
    UserRole["MAGAZZINIERE"] = "MAGAZZINIERE";
    UserRole["OPERATORE"] = "OPERATORE";
    UserRole["COMMERCIALE"] = "COMMERCIALE";
    UserRole["VIEWER"] = "VIEWER";
})(UserRole || (exports.UserRole = UserRole = {}));
// Product Types
var ProductType;
(function (ProductType) {
    ProductType["SIMPLE"] = "SIMPLE";
    ProductType["WITH_VARIANTS"] = "WITH_VARIANTS";
    ProductType["RAW_MATERIAL"] = "RAW_MATERIAL";
    ProductType["DIGITAL"] = "DIGITAL";
})(ProductType || (exports.ProductType = ProductType = {}));
// Inventory Locations
var InventoryLocation;
(function (InventoryLocation) {
    InventoryLocation["WEB"] = "WEB";
    InventoryLocation["B2B"] = "B2B";
    InventoryLocation["EVENTI"] = "EVENTI";
    InventoryLocation["TRANSITO"] = "TRANSITO";
})(InventoryLocation || (exports.InventoryLocation = InventoryLocation = {}));
// Order Status
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["PROCESSING"] = "PROCESSING";
    OrderStatus["READY"] = "READY";
    OrderStatus["SHIPPED"] = "SHIPPED";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["REFUNDED"] = "REFUNDED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
// Constants
exports.API_VERSION = 'v1';
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_PAGE_SIZE = 100;
//# sourceMappingURL=index.js.map