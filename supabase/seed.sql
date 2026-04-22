-- 🧠 Reference Cases Seed Data (RAG Source)

INSERT INTO reference_cases (title, project_type, summary, outcome) VALUES
('ボストン中心部オフィスビル遅延事案', '商業施設', '地下遺構の発見により基礎工事が3ヶ月中断。', '夜間作業の追加と設計の一部簡略化により、最終的な遅延を1ヶ月に短縮。コストは15%上昇。'),
('ウォーターフロント再開発 Go/No-Go', 'インフラ', '地盤沈下リスクが高く、補強費用が当初予算を20%超える見込み。', '将来の維持管理コストを算出し、投資回収が困難と判断して施工を辞退。ブランドイメージへの悪影響は軽微。'),
('大規模病院の設計変更対応', '医療', 'パンデミック対応のための換気システム大幅変更。', '追加費用を発注者と折半することで合意。工期は12%延長したが、将来の需要に応える高品質な施設として評価。');

INSERT INTO reference_case_chunks (case_id, chunk_type, content)
SELECT id, 'overview', summary FROM reference_cases WHERE title = 'ボストン中心部オフィスビル遅延事案';
INSERT INTO reference_case_chunks (case_id, chunk_type, content)
SELECT id, 'outcome', outcome FROM reference_cases WHERE title = 'ボストン中心部オフィスビル遅延事案';

-- Add more chunks as needed
