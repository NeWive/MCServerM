import DBHandler from "../Module/DBHandler";
import config from "../Module/Config";

config.readConfig().then(() => {
    DBHandler.init(true);
});
