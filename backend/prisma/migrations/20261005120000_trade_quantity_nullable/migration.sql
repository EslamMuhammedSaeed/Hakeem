-- Quantity-less Thndr fills are real trades. Existing rows keep their values;
-- only new fills without a share count store NULL. Net amount is NULL in that
-- case because it cannot be computed without a quantity.
ALTER TABLE `Trade`
    MODIFY `quantity` DECIMAL(18, 4) NULL,
    MODIFY `netAmount` DECIMAL(20, 6) NULL;
